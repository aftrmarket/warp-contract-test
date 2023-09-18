import Arweave from "arweave";
import fs, { read } from "fs";
import path from "path";
import { WarpFactory, defaultCacheOptions, SourceType  } from "warp-contracts";
import { DeployPlugin, ArweaveSigner } from "warp-contracts-plugin-deploy";

const ENV = "PROD";
let arweave = {};

if (ENV === "DEV") {
    arweave = Arweave.init({
        host: "localhost",
        port: 1984,
        protocol: "http",
    });
} else {
    arweave = Arweave.init({
        host: "arweave.net",
        port: 443,
        protocol: "https",
    });
}

const __dirname = path.resolve();
const mine = () => arweave.api.get("mine");
let wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "/dev/test-wallet.json")));
const addr = await arweave.wallets.getAddress(wallet);

console.log(addr);

if (ENV === "DEV") {
    await arweave.api.get(`mint/${addr}/10000000000000000`);
    await mine();
}


async function readContract(contractId) {
    const warp = warpInit(ENV);
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            allowBigInt: true,
            internalWrites: true,
            unsafeClient: 'skip'
        });
    const result = await contract.readState();
    await warp.close();
    return result;
}

function warpInit(env) {
    let warp = {};
    if (env === "DEV") {
        warp = WarpFactory.forLocal().use(new DeployPlugin());
    } else if (env === "TEST") {
        warp = WarpFactory.forTestnet().use(new DeployPlugin());
        // warp = WarpFactory.forTestnet({ ...defaultCacheOptions, inMemory: true });
    } else if (env === "PROD") {
        warp = WarpFactory.forMainnet({ ...defaultCacheOptions}).use(new DeployPlugin());
        // warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true }).use(new DeployPlugin());
    }
    return warp;
}

async function warpCreateNewContract(contractSource, initState, wallet) {
    let signer = {};
    if (ENV === "DEV") {
        signer = wallet;
    } else if (ENV === "TEST") {
        signer = new ArweaveSigner(wallet);
    } else if (ENV === "PROD") {
        signer = new ArweaveSigner(wallet);
    }

    const result = await warp.createContract.deploy({
        wallet: signer,
        initState: JSON.stringify(initState),
        src: contractSource,
    });
    return result.contractTxId;
}

async function runInteraction(contractId, input, wallet) {
    const warp = warpInit(ENV);
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            internalWrites: true
        })
        .connect(wallet);

    const result = await contract.writeInteraction(input);
    await warp.close();
    return result;
}

async function viewInteraction(contractId, input, wallet) {
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            internalWrites: true,
            unsafeClient: "skip"
        })
    .connect(wallet);

    const { result } = await contract.viewState(input);
    return result;
}


const players = ["GNWwW6YG6mEMPdwb1xJmTYiNUqZpZeCri_kiy32StQ8", "XlXYsmQFW0LA7WkmqfplDlzEGCROGjLTUopeWIcn3rM", "e1iREP5F4wDfpVTOCKLIhKGXBWXCRw6CIRRYc_nZ5_s", "HCNtdqr9DHI3Kg8xtXz4YbRiuXlygukxpLD7qZqtP7o", "t9J8Cg8I882cZIET5m9_HNAy4MsO_DqpdY36lYEHwpc"];
const teams = ["DuH_O6qXLz7j-2YNqU_fZIsoQKdv38lTQueYEcugM34"];


/*
const warp = warpInit(ENV);
console.log("*** Creating test contract...");
let contractSource = fs.readFileSync(path.join(__dirname, "/contracts/contract-verify-test.js"), "utf8");
let initState = { verified: [] };
const contractId = await warpCreateNewContract(contractSource, initState, wallet);
console.log(contractId);
await warp.close();
*/

const contractId = "6oHMJLeOT1cd_Yvt3LwcJTXFRZMU_2sckIDZHSITx6g";

console.log("*** Running interactions on teams...");
for (const team of teams) {
    
    try {
        const input = {
            function: "propose",
            type: "joinGame",
            target: contractId,
        };
        // if (
        //     game.gameType === "entry fee" ||
        //     game.gameType === "charity"
        // ) {
        //     input.txID = this.allowTxId;
        //     input.qty = this.entryFee;
        // }
        const result = await runInteraction(team, input, wallet);
        console.log(`RESULT: ${JSON.stringify(result)}`);
    } catch (e) {
        console.log(e);
    }
}

// const result = await readContract(contractId);
// console.log(JSON.stringify(result));

