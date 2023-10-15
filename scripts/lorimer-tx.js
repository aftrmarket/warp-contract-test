import fs, { read } from "fs";
import path from "path";
import { WarpFactory } from "warp-contracts";
import { DeployPlugin } from "warp-contracts-plugin-deploy";
import axios from "axios";
import { setTimeout } from "timers/promises";

const __dirname = path.resolve();
const wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "/dev/test-wallet.json")));
const dre_endpoint = "https://dre-aftr.warp.cc";
const team = "cw2u5KUQq54BcDz8QDvUBTHXXwvmsd8wc62dnFUNUHE";
const input1 = {
    function: "propose",
    type: "setTeam",
    value: {
        starters: [
            {
                id: "aeVgb1Y-oR6ol2FU6g7eY-iJrLwNWxbzpvHAs9mXh_I",
                position: "qb",
                orgId: "DUKE",
            },
        ],
        bench: [],
    },
};

const input2 = {
    function: "propose",
    type: "setTeam",
    value: {
        starters: [],
        bench: [
            {
                id: "aeVgb1Y-oR6ol2FU6g7eY-iJrLwNWxbzpvHAs9mXh_I",
                position: "qb",
                orgId: "DUKE",
            },
        ],
    },
};

let input = input1;

async function readContract(contractId) {
    const dre = dre_endpoint;
    const dreUrl = `${dre}/contract?id=${contractId}`;
    let response = {};
    try {
        response = await axios.get(dreUrl);
    } catch(e) {
        console.log(`ERROR FETCHING CONTRACT: ${e}`);
    }
    return response.data;
}

async function runInteraction(contractId, input, wallet) {
    const warp = WarpFactory.forMainnet().use(new DeployPlugin());
    // const warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true });

    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            internalWrites: true,
            remoteStateSyncSource: dre_endpoint
        })
        .connect(wallet);

    const result = await contract.writeInteraction(input);
    await warp.close();
    return result;
}

// Read contract
let beforeInteraction = await readContract(team);
input = (beforeInteraction.state.teamSetup.starters.length == 0) ? input1 : input2;
const tx = await runInteraction(team, input, wallet);

await setTimeout(5000);     // Wait for DRE to update

let afterInteraction = await readContract(team);

console.log(`BEFORE: ${JSON.stringify(beforeInteraction.state.teamSetup)}`);
console.log(`AFTER: ${JSON.stringify(afterInteraction.state.teamSetup)}`);


