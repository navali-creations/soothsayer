import fs from "node:fs";

/**
 * New line character.
 */
const NEW_LINE_CODE = "\n".charCodeAt(0);

/**
 * Buffer size to use.
 */
const BUFFER_SIZE = 256;

/**
 * Scans the file from the end for lines.
 */
async function readLastLinesFromFile(
  file: fs.promises.FileHandle,
  maxLineCount: number,
  encoding?: BufferEncoding,
): Promise<string> {
  const stat = await file.stat();
  let remainingBytes = stat.size;
  let lineCount = 0;
  const prevBuffers: Buffer[] = [];

  /**
   *  `outer` is a loop label that allows the code to break out of the outer while loop from within the nested for loop when it has found enough lines.
   *  This is a convenient way to exit multiple nested loops at once without using additional flags or return statements.
   */
  outer: while (remainingBytes > 0) {
    //read a buffer
    const bufferLen = Math.min(BUFFER_SIZE, remainingBytes);
    const position = remainingBytes - bufferLen;
    const { bytesRead, buffer } = await file.read({
      buffer: Buffer.alloc(bufferLen),
      offset: 0,
      length: bufferLen,
      position,
    });

    if (bytesRead !== bufferLen) {
      throw new Error("read size mismatch");
    }

    //scan for new line (\n or \r\n)
    for (let i = bufferLen - 1; i >= 0; i--) {
      if (buffer[i] === NEW_LINE_CODE) {
        lineCount++;

        //check end condition
        if (lineCount >= maxLineCount) {
          prevBuffers.push(buffer.subarray(i + 1));
          break outer;
        }
      }
    }

    prevBuffers.push(buffer);

    //next
    remainingBytes -= bufferLen;
  }

  return Buffer.concat(prevBuffers.reverse()).toString(encoding);
}

/**
 * Read in the last `n` lines of a file.
 *
 * Code based on https://github.com/alexbbt/read-last-lines/issues/39.
 *
 * @param inputFilePath file (direct or relative path to file.)
 * @param maxLineCount max number of lines to read in.
 * @param encoding
 *
 * @return a promise resolved with the lines or rejected with an error.
 */
export async function readLastLines(
  inputFilePath: string,
  maxLineCount: number,
  encoding?: BufferEncoding,
): Promise<string> {
  //validate
  if (maxLineCount <= 0) {
    return "";
  }

  //scan
  let file: fs.promises.FileHandle | undefined;

  try {
    //open file for reading
    file = await fs.promises.open(inputFilePath, "r");

    return await readLastLinesFromFile(file, maxLineCount, encoding);
  } finally {
    await file?.close();
  }
}
