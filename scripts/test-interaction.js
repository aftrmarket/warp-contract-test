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

let PLATFORM_WALLET = "";
if (ENV === "TEST") {
    PLATFORM_WALLET = process.env.WALLET_TEST;
} else if (ENV === "PROD") {
    // PLATFORM_WALLET = process.env.WALLET_PROD;
    //TODO: JUST TESTING with read contract
    PLATFORM_WALLET = process.env.WALLET_TEST;
} else {
    PLATFORM_WALLET = process.env.WALLET_DEV;
}

const __dirname = path.resolve();
const mine = () => arweave.api.get("mine");
let wallet = JSON.parse(fs.readFileSync(path.join(__dirname, PLATFORM_WALLET)));


async function readContract(contractId) {
    console.log("**** READING CONTRACT:");

    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            allowBigInt: true,
            internalWrites: true,
            unsafeClient: 'skip',
            remoteStateSyncEnabled: true,
            remoteStateSyncSource: "https://dre1.othent.io/contracts",
            //sourceType: SourceType.BOTH,
            //whitelistSources: ["HqResQhOYlF-I7hb7Bk6zOM0Sv0kklPMeII6Rw9VPxY", "qOBGIEa75RthjyO6fsEtPKV8M_--KUhRbouTWsMy-ec"]
        });
    const result = await contract.readState();
    //console.log(JSON.stringify(result));
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
        warp = WarpFactory.forMainnet().use(new DeployPlugin());
        // warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true });
    }
    return warp;
}

async function runInteraction(contractId, input, wallet) {
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            internalWrites: true
        })
        .connect(wallet);

    const txId = await contract.writeInteraction(input);
    console.log("*** INTERACTION txId: " + txId.originalTxId);
    return txId.originalTxId;
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

// const contractId = "t5VFXv-YC4c4U5JhAk6kChQE8XArkj44DIbOh1kCvj8";   // Team Registry Contract
const contractId = "kXaBP8ecV0djbUkocQWvCc7G2fSF8LJxriZJwJmGI1I";  // Work Contract
// const contractId = "KTzTXT_ANmF84fWEKHzWURD1LWd9QaFR9yfYUwH2Lxw";   // U Contract on Mainnet
const warp = warpInit(ENV);

let input = {
    function: "mint",
    qty: 100000000,
    target: "STj1z-2f9PM1WKTiBKZ4vsRaCH_LBYChq8SAsdeUGjk"
};
const result = await runInteraction(contractId, input, wallet);
console.log(`RESULT: ${JSON.stringify(result)}`);

// let input = {
//     function: "balance",
//     target: "Fof_-BNkZN_nQp0VsD_A9iGb-Y4zOeFKHA8_GK2ZZ-I"
// }
// const result = await viewInteraction(contractId, input, wallet);
// console.log(`RESULT: ${JSON.stringify(result)}`);

// const nextContract = await readContract(contractId);
// console.log(JSON.stringify(nextContract.cachedValue));


/***
 * Test Interaction on Contract Resiliency
 */

// const testContractId = "Fgp8ymuZMkFhVH8Qae3Y-aE0UcS9UFQEnpBscDwdJng";

// let input = {
//     function: "internalWriteFail",
//     contractId: "l0pUw7D5o_05E2B9Ua2zvr-cOxFflhVezaH108YtGQ0", // Play Token
// }
// const result = await runInteraction(testContractId, input, wallet);
// console.log(`RESULT: ${JSON.stringify(result)}`);


// let input = {
//     function: "allow",
//     qty: 1,
//     target: "VigdvLo8tdNjjFlK69lZ-uBIsvhEtNjR3GqsrkMl-f0"
// };
// const result = await runInteraction(contractId, input, wallet);
// console.log(`RESULT: ${JSON.stringify(result)}`);