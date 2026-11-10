import { expose } from "comlink";

import { loadLatest } from "../data";
import { runJob, type SimWorker } from "./runner";

const patch = loadLatest();

const api: SimWorker = { run: (job) => runJob(job, patch) };
expose(api);
