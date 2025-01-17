import { HexString, UnixTimestamp } from "@pythnetwork/pyth-common-js";
import { DurationInSeconds } from "./utils";

export type PriceItem = {
  id: HexString;
  alias: string;
};

export type PriceInfo = {
  price: string;
  conf: string;
  publishTime: UnixTimestamp;
};

export interface IPriceListener {
  // start fetches the latest price initially and then keep updating it
  start(): Promise<void>;
  getLatestPriceInfo(priceId: string): PriceInfo | undefined;
}

export abstract class ChainPriceListener implements IPriceListener {
  private latestPriceInfo: Map<HexString, PriceInfo>;
  protected priceIdToAlias: Map<HexString, string>;

  constructor(
    private chain: string,
    private pollingFrequency: DurationInSeconds,
    protected priceItems: PriceItem[]
  ) {
    this.latestPriceInfo = new Map();
    this.priceIdToAlias = new Map(
      priceItems.map(({ id, alias }) => [id, alias])
    );
  }

  async start() {
    console.log(`Polling the prices every ${this.pollingFrequency} seconds...`);
    setInterval(this.pollPrices.bind(this), this.pollingFrequency * 1000);

    await this.pollPrices();
  }

  private async pollPrices() {
    console.log(`Polling ${this.chain} prices...`);
    for (const { id: priceId } of this.priceItems) {
      const currentPriceInfo = await this.getOnChainPriceInfo(priceId);
      if (currentPriceInfo !== undefined) {
        this.updateLatestPriceInfo(priceId, currentPriceInfo);
      }
    }
  }

  protected updateLatestPriceInfo(
    priceId: HexString,
    observedPrice: PriceInfo
  ) {
    const cachedLatestPriceInfo = this.getLatestPriceInfo(priceId);

    // Ignore the observed price if the cache already has newer
    // price. This could happen because we are using polling and
    // subscription at the same time.
    if (
      cachedLatestPriceInfo !== undefined &&
      cachedLatestPriceInfo.publishTime > observedPrice.publishTime
    ) {
      return;
    }

    this.latestPriceInfo.set(priceId, observedPrice);
  }

  // Should return undefined only when the price does not exist.
  getLatestPriceInfo(priceId: string): PriceInfo | undefined {
    return this.latestPriceInfo.get(priceId);
  }

  abstract getOnChainPriceInfo(
    priceId: HexString
  ): Promise<PriceInfo | undefined>;
}

export interface ChainPricePusher {
  updatePriceFeed(
    priceIds: string[],
    pubTimesToPush: UnixTimestamp[]
  ): Promise<void>;
}
