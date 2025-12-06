import { ipcRenderer } from "electron";
import { PoeNinjaChannel } from "./PoeNinja.channels";

const PoeNinjaAPI = {
  fetchExchangePrices: (league: string = "Keepers") =>
    ipcRenderer.invoke(PoeNinjaChannel.FetchExchangePrices, league),
  fetchStashPrices: (league: string = "Keepers") =>
    ipcRenderer.invoke(PoeNinjaChannel.FetchStashPrices, league),
};

export { PoeNinjaAPI };
