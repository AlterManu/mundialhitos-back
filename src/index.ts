import app from "./app";
import { AppDataSource } from "./config/dataSource";

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    await AppDataSource.initialize();
    app.listen(PORT);
    console.log("---------- Server running on port", PORT);
  } catch (error) {
    console.error(error);
  }
}

main();
