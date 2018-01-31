import Bot from "../../models/bot";
import Storage from "../../models/storage";
import BotService from "../bot";

export default class TableStorageBotService implements BotService {
  getBotById(botId: string) {
    // TODO
    return new Bot(botId, []);
  }
}
