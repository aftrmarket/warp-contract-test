// import ArLocal from 'arlocal';
import fs from 'fs';
import path from 'path';
import { WarpFactory } from 'warp-contracts';
import { DeployPlugin } from 'warp-contracts-plugin-deploy';
import Arweave from "arweave";


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

async function deploy() {

    const __dirname = path.resolve();
    // let arlocal = new ArLocal(1820, false);
    // await arlocal.start();

    let arweave = arweaveInit();
    const mine = () => arweave.api.get("mine");
    const wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "./dev/test-wallet.json")));
    const walletAddr = await arweave.wallets.getAddress(wallet);

    await arweave.api.get(`mint/${walletAddr}/10000000000000000`);
    await mine();

    let warp = WarpFactory.forLocal().use(new DeployPlugin());
    let ownerWallet = {};
    let owner = "";
    let contractId = "";
    //({ jwk: ownerWallet, address: owner } = await warp.generateWallet());


    const playerRegContractSrc = "/contracts/contract-player-reg.js";
    // Player Registry
    let contractSource = fs.readFileSync(path.join(__dirname, playerRegContractSrc), "utf8");
    let initState = {
        register: [], 
        season: "2023"
    };

    // ({ contractTxId: contractId } = await warp.deploy({
    //     wallet: wallet,
    //     initState: JSON.stringify(initState),
    //     src: contractSource,
    //     evaluationManifest: {
    //         evaluationOptions: {
    //             useKVStorage: true,
    //         },
    //     },
    // }));
    let result = await warp.deploy({
        wallet: wallet,
        initState: JSON.stringify(initState),
        src: contractSource,
        evaluationManifest: {
            evaluationOptions: {
                useKVStorage: true,
            },
        },
    });
    console.log('Deployed contract: ', result.contractTxId);
    // let contract = warp
    //     .contract(contractId)
    //     .connect(ownerWallet)
    //     .setEvaluationOptions({ useKVStorage: true });


    // await arlocal.stop();


}

await deploy();