import Bot from "../../models/bot";
import Storage from "../../models/storage";
import BotService from "../bot";
import Google from "../../models/adapters/google";
import * as NodePersist from "node-persist";

export default class FilesystemBotService implements BotService {
  bots: Bot[];

  constructor() {
    NodePersist.initSync();
    this.loadBots();
  }

  getBotById(botId: string) {
    const bot = this.bots.find(b => b.id === botId);
    if (bot) {
      return bot;
    } else {
      return;
    }
  }

  getBots() {
    return this.bots;
  }

  addBot(data: Bot) {
    if (this.getBotById(data.id)) {
      throw new Error("Bot with given ID already exists.");
    }

    const bot = Bot.create(data);
    this.bots.push(Bot.create(data));
    this.saveBots();
    return bot;
  }

  protected loadBots() {
    this.bots = (NodePersist.getItemSync("bots") || []).map((bot: Bot) => Bot.create(bot));
  }

  protected saveBots() {
    NodePersist.setItemSync("bots", this.bots);
  }
}
