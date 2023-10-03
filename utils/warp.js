import { WarpFactory, defaultCacheOptions } from "warp-contracts";
import { DeployPlugin, ArweaveSigner } from "warp-contracts-plugin-deploy";
import Arweave from "arweave";

const CACHE = true;

function arweaveInit(env = "DEV") {
    let arweave = {};
    if (env === "DEV") {
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
    return arweave;
}


function warpInit(env = "DEV", cache = CACHE) {
    let warp = {};
    if (env === "DEV") {
        warp = WarpFactory.forLocal().use(new DeployPlugin());
    } else if (env === "TEST") {
        warp = cache ? WarpFactory.forTestnet({ ...defaultCacheOptions}).use(new DeployPlugin()) : WarpFactory.forTestnet({ inMemory: true }).use(new DeployPlugin());
    } else if (env === "PROD") {
        warp = cache ? WarpFactory.forMainnet({ ...defaultCacheOptions}).use(new DeployPlugin()) : WarpFactory.forMainnet({ inMemory: true }).use(new DeployPlugin());
    }
    return warp;
}

async function warpRead(contractId, env = "DEV", cache = CACHE) {
    const warp = warpInit(env, cache);
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            allowBigInt: true,
            internalWrites: true,
            unsafeClient: 'skip',
            remoteStateSyncSource: "https://dre-aftr.warp.cc"
        });
    const result = await contract.readState();
    if (env !== "DEV") {
        await warp.close();
    }
    return result;
}

async function warpCreateNewContract(contractSource, initState, wallet, env = "DEV") {
    const signer = env === "DEV" ? wallet : new ArweaveSigner(wallet);
    const warp = warpInit(env);    
    const result = await warp.deploy({
        wallet: signer,
        initState: JSON.stringify(initState),
        src: contractSource,
    });
    if (env !== "DEV") {
        await warp.close();
    }
    return result.contractTxId;
}

async function warpCreateContractFromTx(sourceId, initState, wallet, env = "DEV") {
    const signer = env === "DEV" ? wallet : new ArweaveSigner(wallet);
    const warp = warpInit(env);
    const result = await warp.deployFromSourceTx({
        wallet: signer,
        initState: JSON.stringify(initState),
        srcTxId: sourceId
    });
    if (env !== "DEV") {
        await warp.close();
    }
    return result.contractTxId;
}

async function warpWrite(contractId, input, wallet, env = "DEV") {
    const warp = warpInit(env);
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            internalWrites: true,
            remoteStateSyncSource: "https://dre-aftr.warp.cc"
        })
        .connect(wallet);

    const result = await contract.writeInteraction(input);
    if (env !== "DEV") {
        await warp.close();
    }
    return result;
}

async function warpCreateSource(contractSource, wallet, env = "DEV") {
    const warp = warpInit(env);
    const signer = env === "DEV" ? wallet : new ArweaveSigner(wallet);
    const newSource = await warp.createSource({ src: contractSource }, signer);
    const newSrcId = await warp.saveSource(newSource);
    if (env !== "DEV") {
        await warp.close();
    }
    return newSrcId;
}


export { arweaveInit, warpInit, warpCreateNewContract, warpCreateContractFromTx, warpRead, warpWrite, warpCreateSource };