import Arweave from "arweave";
import { WarpFactory, defaultCacheOptions } from "warp-contracts";
import { DeployPlugin } from "warp-contracts-plugin-deploy";

let arweave = {};

const ENV = "PROD";

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

async function readContract(contractId) {
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            allowBigInt: true,
            internalWrites: true,
            unsafeClient: 'skip',
            remoteStateSyncEnabled: true,  // WE HAVE TO TURN THIS OFF IN ORDER FOR THE CONTRACT TO EVALUATE CORRECTLY
            // remoteStateSyncSource: "https://dre-1.warp.cc/contract"
        })
    const result = await contract.readState();
    console.log(JSON.stringify(result));
    return result;
}

function warpInit(env) {
    let warp = {};
    if (env === "DEV") {
        warp = WarpFactory.forLocal().use(new DeployPlugin());
    } else if (env === "TEST") {
        warp = WarpFactory.forTestnet().use(new DeployPlugin());
    } else if (env === "PROD") {
        /*** 
         * If you run using inMemory: true first, then everything appears to be fine.
         * But, if you run it without inMemore: true, then interactions are different.
         */
        // warp = WarpFactory.forMainnet().use(new DeployPlugin());  
        // warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true }); // TOO SLOW FOR PRODUCT USE
        warp = WarpFactory.forMainnet({ ...defaultCacheOptions});
    }
    return warp;
}



/*** BEGIN SCRIPT */
const contractId = "6BZMY6p0Ub2lq-4ng6QwKLOvzyHd5ZrQwERSO-vNr6U";  
const warp = warpInit(ENV);

const result = await readContract(contractId);

console.log(`INTERACTIONS: ${Object.entries(result.cachedValue.validity).length}`);