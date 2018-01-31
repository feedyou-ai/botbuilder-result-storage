import Bot from "../models/bot";

export default interface BotService {
  getBotById(botId: string): Bot;
}
