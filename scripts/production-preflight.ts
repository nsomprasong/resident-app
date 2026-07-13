import "dotenv/config";

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getMissingEnvironment,
  requiredProductionEnvironment,
  requiredProductionFiles,
} from "../lib/production/readiness";

const missingEnvironment = getMissingEnvironment(process.env);
const missingFiles = requiredProductionFiles.filter(
  (filePath) => !existsSync(join(process.cwd(), filePath)),
);

if (missingEnvironment.length || missingFiles.length) {
  console.error("Production preflight failed.");

  if (missingEnvironment.length) {
    console.error(
      `Missing environment variables: ${missingEnvironment.join(", ")}`,
    );
  }

  if (missingFiles.length) {
    console.error(`Missing required files: ${missingFiles.join(", ")}`);
  }

  process.exit(1);
}

console.log("Production preflight passed.");
console.log(
  `Validated env: ${requiredProductionEnvironment.join(", ")}; files: ${requiredProductionFiles.join(", ")}`,
);
