import * as express from "express";
import * as dotenv from "dotenv";
import * as path from "path";
import * as bodyParser from "body-parser";

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config({ path: ".env.example" });

// Controllers (route handlers)
import * as homeController from "./controllers/home";
import * as apiController from "./controllers/api";
import * as botController from "./controllers/bot";

// Create Express server
const app = express();

// Express configuration
app.set("port", process.env.PORT || 3000);
app.use(express.static(path.join(__dirname, "public"), { maxAge: 31557600000 }));
app.use(bodyParser.json());

app.get("/", homeController.index);
app.get("/api", apiController.getApi);

app.get("/api/bots", botController.getBots);
app.get("/api/bots/:bot_id", botController.getBot);
app.post("/api/bots", botController.addBot);
app.post("/api/bots/:bot_id/row", botController.storeRow);

module.exports = app;
