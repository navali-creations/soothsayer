import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const PAGE_URL = "https://www.poewiki.net/wiki/List_of_divination_cards";
const OUT_ASSETS_DIR = path.resolve("./src/assets/poe1/divination-card-images");

/** Make a filename-safe slug, but keep it readable */
function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "") // strip punctuation
    .trim()
    .replace(/\s+/g, "_"); // spaces -> _
}

function absUrl(src) {
  if (!src) return null;
  try {
    return new URL(src, PAGE_URL).toString();
  } catch {
    return null;
  }
}

async function downloadImage(url, filePath) {
  console.error(`  Downloading: ${path.basename(filePath)}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buf);
  console.error(`  ✓ Saved: ${path.basename(filePath)}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function guessExtFromUrl(url) {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname);
    if (ext && ext.length <= 5) return ext; // .png, .jpg, .webm etc
  } catch {}
  return ".png";
}

async function main() {
  console.error("Step 1: Creating assets directory...");
  await fs.mkdir(OUT_ASSETS_DIR, { recursive: true });
  console.error(`  ✓ Assets dir: ${OUT_ASSETS_DIR}`);

  console.error("\nStep 2: Launching headless browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Block unnecessary resources to speed up loading
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const resourceType = req.resourceType();
    if (["font", "stylesheet"].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  console.error(`  ✓ Browser launched`);

  console.error("\nStep 3: Fetching page from PoE Wiki...");
  try {
    await page.goto(PAGE_URL, {
      waitUntil: "domcontentloaded", // Less strict than networkidle
      timeout: 30000,
    });
    console.error(`  ✓ Page loaded (DOM ready)`);

    // Wait for the table to be present
    console.error("  Waiting for main table...");
    await page.waitForSelector("table.wikitable", { timeout: 10000 });
    console.error(`  ✓ Table found`);

    // Wait a bit for any dynamic content
    console.error("  Waiting 5 seconds for dynamic content...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.error(`  ✓ Wait complete`);

    const html = await page.content();
    console.error(
      `  ✓ HTML extracted, size: ${(html.length / 1024).toFixed(2)} KB`,
    );

    await browser.close();
    console.error(`  ✓ Browser closed`);

    const $ = cheerio.load(html);

    // Find table
    console.error("\nStep 4: Finding main table...");
    const $table = $("table.wikitable").first();
    if (!$table.length) throw new Error("No table.wikitable found.");
    console.error(`  ✓ Found table.wikitable`);

    // figure out header indices
    let idxItem = 0,
      idxStack = 1,
      idxDesc = 2;

    const headerTexts = $table
      .find("thead tr")
      .first()
      .find("th")
      .toArray()
      .map((th) => $(th).text().trim().toLowerCase());

    console.error(`  ✓ Headers found: ${headerTexts.join(", ")}`);

    const findIdx = (names) => {
      for (const n of names) {
        const i = headerTexts.findIndex((t) => t === n);
        if (i !== -1) return i;
      }
      return -1;
    };

    const iItem = findIdx(["item"]);
    const iStack = findIdx(["stack size", "stack"]);
    const iDesc = findIdx(["description"]);

    if (iItem !== -1) idxItem = iItem;
    if (iStack !== -1) idxStack = iStack;
    if (iDesc !== -1) idxDesc = iDesc;

    console.error(
      `  ✓ Column indices: Item=${idxItem}, Stack=${idxStack}, Desc=${idxDesc}`,
    );

    // build base list from tbody
    console.error("\nStep 5: Parsing card data from table...");
    const cards = [];
    const byName = new Map();

    $table.find("tbody tr").each((_, tr) => {
      const $tds = $(tr).find("td");
      if ($tds.length < 3) return;

      const $nameTd = $tds.eq(idxItem);
      const name = $nameTd.find("a").first().text().trim();
      if (!name) return;

      const $stackTd = $tds.eq(idxStack);
      const sortStack = $stackTd.attr("data-sort-value");
      const stack_size = Number.parseInt(
        sortStack ?? $stackTd.text().trim(),
        10,
      );
      if (!Number.isFinite(stack_size)) return;

      const $descTd = $tds.eq(idxDesc);
      const sortReward = $descTd.attr("data-sort-value");
      const reward_html = (sortReward ?? $descTd.html() ?? "").trim();
      const description = $descTd.text().replace(/\s+/g, " ").trim();

      const art_src = `./src/assets/poe1/${slugify(name)}`;
      const flavour_html = "";

      const row = {
        name,
        stack_size,
        description,
        reward_html,
        art_src,
        flavour_html,
      };
      cards.push(row);
      byName.set(name, row);
    });

    console.error(`  ✓ Parsed ${cards.length} cards from table`);

    // enrich from hoverbox
    console.error("\nStep 6: Looking for hoverbox with card images...");
    const $hover = $(".hoverbox-display-container").first();

    if (!$hover.length) {
      console.error("  ⚠ No .hoverbox-display-container found!");
    } else {
      console.error(`  ✓ Found .hoverbox-display-container`);
      const $spans = $hover.children("span");
      console.error(`  ✓ Found ${$spans.length} span children`);
    }

    // Collect all download promises
    const downloadPromises = [];
    let foundImages = 0;
    let matchedCards = 0;
    let processedSpans = 0;
    let skippedExisting = 0;

    if ($hover.length) {
      for (const span of $hover.children("span").toArray()) {
        const $span = $(span);
        const idx = processedSpans;
        processedSpans++;

        const $divi = $span.find('[class$="-divicard"]').first().length
          ? $span.find('[class$="-divicard"]').first()
          : $span.find('[class*="divicard"]').first();

        if (!$divi.length) {
          continue;
        }

        // Let's look for the image in different places
        const $header = $span.find(".divicard-header").first();
        const name = $header.text().replace(/\s+/g, " ").trim();
        if (!name) {
          continue;
        }

        const target = byName.get(name);
        if (!target) {
          continue;
        }

        matchedCards++;

        // Try to find the image anywhere in the span, not just in header
        let imgSrc = $header.find("img").first().attr("src");

        // If not in header, try anywhere in the divicard element
        if (!imgSrc) {
          imgSrc = $divi.find("img").first().attr("src");
        }

        // If still not found, try anywhere in the span
        if (!imgSrc) {
          imgSrc = $span.find("img").first().attr("src");
        }

        const imgUrl = absUrl(imgSrc);

        if (!imgSrc) {
          // Skip silently
        } else if (!imgUrl) {
          console.error(`  [${name}] Could not parse img URL from: ${imgSrc}`);
        } else {
          foundImages++;
          const ext = guessExtFromUrl(imgUrl);
          const filename = `${slugify(name)}${ext}`;
          const filePath = path.join(OUT_ASSETS_DIR, filename);

          target.art_src = filename;

          // Check if file already exists
          const exists = await fileExists(filePath);
          if (exists) {
            skippedExisting++;
          } else {
            const downloadPromise = downloadImage(imgUrl, filePath).catch(
              (err) => {
                console.warn(
                  `  ✗ Art download failed for "${name}": ${err.message}`,
                );
              },
            );
            downloadPromises.push(downloadPromise);
          }
        }

        const $flavour = $span.find(".divicard-flavour").first();
        if ($flavour.length) {
          const inner = (
            $flavour.find("span").first().html() ??
            $flavour.html() ??
            ""
          ).trim();
          target.flavour_html = inner;
        }
      }
    }

    console.error(`\nStep 7: Summary`);
    console.error(`  Cards in table: ${cards.length}`);
    console.error(`  Processed spans: ${processedSpans}`);
    console.error(`  Matched cards from hoverbox: ${matchedCards}`);
    console.error(`  Images found: ${foundImages}`);
    console.error(`  Already downloaded (skipped): ${skippedExisting}`);
    console.error(`  New downloads queued: ${downloadPromises.length}`);

    // Wait for all downloads to complete
    console.error(`\nStep 8: Downloading ${downloadPromises.length} images...`);
    if (downloadPromises.length > 0) {
      await Promise.allSettled(downloadPromises);
      console.error(`  ✓ Download complete!`);
    } else {
      console.error(`  ⚠ No new images to download!`);
    }

    console.error("\nStep 9: Outputting JSON...");
    console.log(JSON.stringify(cards, null, 2));
    console.error("  ✓ Done!");
  } catch (error) {
    await browser.close();
    throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
