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
// let wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "/files/keyfile-test.json")));
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

async function warpCreateContractFromTx(sourceId, initState, wallet) {
    /*** TODO:  ADJUST TAGS FOR ENVIRONMENT */
    let tags = [];
    tags.push( { name: "Protocol", value: "AFTR-WORK-TEST" } );
    /*** */

    let signer = {};
    if (ENV === "DEV") {
        signer = wallet;
    } else if (ENV === "TEST") {
        signer = new ArweaveSigner(wallet);
    } else if (ENV === "PROD") {
        signer = new ArweaveSigner(wallet);
    }
    const result = await warp.deployFromSourceTx({
        wallet: signer,
        initState: JSON.stringify(initState),
        srcTxId: sourceId,
        tags
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


// const teamId = "SXSqfG5Tx6VGsj6u_LrV2C44Sj1VKmJFf0lxHSUodrQ";

const gameInitState = {
    name: "Test Remote Join",
    ticker: "REMOTE-TEST",
    balances: { bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU: 1 },
    owner: "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU",
    gameStatus: "open",
    participants: [],
    invites: [],
    maxParticipants: 0,
    minParticipants: 0,
    gameLength: {
        end: 3,
        start: 3,
        endDate: "09/20/2022",
        startDate: "09/16/2022"
    },
    gameType: "free",
    gameParameters: {
        winners: {},
        entryFee: 0,
        starters: {
            qb: 1,
            rb: 2,
            wr: 3,
            d: 1,
            k: 1
        },
        orgsPermitted:["BC","CLEM","DUKE","FSU","GT","LOU","MIAMI","NCST","UNC","PITT","SYR","UVA","VT","WAKE"]
    },
    history: []
};


// let warp = warpInit(ENV);
// console.log("*** Creating game test contract...");
// let contractSource = fs.readFileSync(path.join(__dirname, "/contracts/contract-game.js"), "utf8");
// let initState = { participants: [] };
// const gameContractId = await warpCreateNewContract(contractSource, gameInitState, wallet);
// await warp.close();

// let warp = warpInit(ENV);
// console.log("*** Creating team test contract...");
// let contractSource = fs.readFileSync(path.join(__dirname, "/contracts/contract-callJoin.js"), "utf8");
// const teamInitState = fs.readFileSync(path.join(__dirname, "/files/team.json"), "utf8");
// const teamContractId = await warpCreateContractFromTx("bgnZiBPx9QZK2cnRuLZ22s9w6UeiNWPQ_idgWIl3Nes", teamInitState, wallet);
// await warp.close();

// console.log(`GAME CONTRACT: ${gameContractId}`);
// console.log(`TEAM CONTRACT: ${teamContractId}`);


const gameContractId = "ztwXLZ8cr__L6gCOodIgLamDuAGPbCk4dyFavDJIHLw";
// // const gameContractId = "RQwQnsiggs17f-EOY4om9LS933HRBQYEM8c86KyLTiM";  // GAME SHOWS ERROR
// // const teamContractId  = "E24CR-IIPM2FPQC_UjxTiiw6UV_DtYUhCTBReXwCRz4";
const teamContractId = "SXSqfG5Tx6VGsj6u_LrV2C44Sj1VKmJFf0lxHSUodrQ"; // 2nd team

const input = {
    function: "propose",
    type: "joinGame",
    target: gameContractId,
};
const result = await runInteraction(teamContractId, input, wallet);
console.log(`RESULT: ${JSON.stringify(result)}`);



// let result = await readContract(teamContractId);
// console.log(JSON.stringify(result));

