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

async function readContract(contractId, cache = false) {
    const warp = warpInit(cache);
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

function warpInit(cache = false) {
    let warp = {};
    if (cache) {
        warp = WarpFactory.forMainnet({ ...defaultCacheOptions}).use(new DeployPlugin());    
    } else {
        warp = WarpFactory.forMainnet({ ...defaultCacheOptions, inMemory: true }).use(new DeployPlugin());
    }
    return warp;
}

async function warpCreateNewContract(contractSource, initState, wallet) {
    const signer = new ArweaveSigner(wallet);

    const result = await warp.createContract.deploy({
        wallet: signer,
        initState: JSON.stringify(initState),
        src: contractSource,
    });
    return result.contractTxId;
}

async function warpCreateContractFromTx(sourceId, initState, wallet) {
    /*** TODO:  ADJUST TAGS FOR ENVIRONMENT */
    let tags = [];
    tags.push( { name: "Protocol", value: "AFTR-WORK-TEST" } );
    /*** */

    const signer = new ArweaveSigner(wallet);
   
    const result = await warp.deployFromSourceTx({
        wallet: signer,
        initState: JSON.stringify(initState),
        srcTxId: sourceId,
        tags
    });
    return result.contractTxId;
}

async function runInteraction(contractId, input, wallet) {
    const warp = warpInit(CACHE);
    const contract = warp.contract(contractId)
        .setEvaluationOptions({
            internalWrites: true
        })
        .connect(wallet);

    const result = await contract.writeInteraction(input);
    await warp.close();
    return result;
}

const CACHE = true;

// let warp = warpInit(CACHE);
// console.log("*** Creating player test contract...");
// let contractSource = fs.readFileSync(path.join(__dirname, "/contracts/contract-player.js"), "utf8");
// let initState = fs.readFileSync(path.join(__dirname, "/files/player-test.json"), "utf8");
// const playerContractId = await warpCreateNewContract(contractSource, initState, wallet);
// await warp.close();

// console.log(`PLAYER CONTRACT: ${playerContractId}`);

// let warp = warpInit(CACHE);
// console.log("*** Creating team test contract...");
// let contractSource = fs.readFileSync(path.join(__dirname, "/contracts/contract-team.js"), "utf8");
// const teamInitState = fs.readFileSync(path.join(__dirname, "/files/team.json"), "utf8");
// // const teamContractId = await warpCreateContractFromTx("bgnZiBPx9QZK2cnRuLZ22s9w6UeiNWPQ_idgWIl3Nes", teamInitState, wallet);
// const teamContractId = await warpCreateNewContract(contractSource, teamInitState, wallet);
// await warp.close();

// console.log(`GAME CONTRACT: ${gameContractId}`);
// console.log(`TEAM CONTRACT: ${teamContractId}`);

// const playerId = "fT561zunBM60fSFG4lJ54x8M18H2jC682xU9pVSHG54";
const playerId = "xtxuk4HLne_wBytn9RAbD_C-JGkumx5KQGU3i7i8F7M";
const teamId = "H1doqUpcNYDcoQiWYcP4plGOzfWRbwObdY7cyNuh_Wc"; // Original team with the successful txs
// const teamId = "BEtSpJVXChHkEyhjA1_SNZs9BwhAVD8S6WY6aWEdqrg";   // New team
const currencyId = "kXaBP8ecV0djbUkocQWvCc7G2fSF8LJxriZJwJmGI1I";

let input = {};

// Get player price
const playerReg = await readContract("ff_h3b1xdzDhqLaPKsmiWuhe012VzZmB40b1Cn9dBtk", true);
const player = playerReg.cachedValue.state.register.find( (p) => p.id === playerId);

console.log("*** TX1 Allow...");
input = {
    function: "allow",
    target: playerId,
    qty: player.price,
};
const tx1 = await runInteraction(currencyId, input, wallet);
console.log(`RESULT: ${JSON.stringify(tx1)}`);

console.log("*** TX2 Deposit to Player...");
input = {
    function: "deposit",
    tokenId: currencyId,
    txID: tx1.originalTxId,
    target: teamId,
    qty: player.price,
};
const tx2 = await runInteraction(playerId, input, wallet);
console.log(`RESULT: ${JSON.stringify(tx2)}`);


console.log("*** TX3 Deposit to Team...");
input = {
    function: "deposit",
    tokenId: playerId,
    txID: tx2.originalTxId,
    qty: 1,
};
const tx3 = await runInteraction(teamId, input, wallet);
console.log(`RESULT: ${JSON.stringify(tx3)}`);


// Read Team Contract with cache
let result1 = await readContract(teamId, true);

// Read Team without cache
let result2 = await readContract(teamId, false);

console.log(JSON.stringify(result1));
console.log(JSON.stringify(result2));

