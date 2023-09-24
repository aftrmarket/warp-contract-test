import fs, { read } from "fs";
import path from "path";
import { arweaveInit, warpRead, warpCreateSource, warpCreateContractFromTx } from "../utils/warp.js";

const arweave = arweaveInit("DEV");

const __dirname = path.resolve();
const mine = () => arweave.api.get("mine");


async function deploy(env = "DEV") {

    // const playerContractSrc= "/contracts/sources/player/contract-source-wo-reject.js";
    const playerContractSrc= "/contracts/joe-source.js";

    const wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "./dev/test-wallet.json")));
    const walletAddr = await arweave.wallets.getAddress(wallet);

    // Airdrop amount of tokens (in winston) to wallet
    if (env === "DEV") {
        await arweave.api.get(`mint/${walletAddr}/10000000000000000`);
        await mine();
    }

    // Create source
    const contractSource = fs.readFileSync(path.join(__dirname, playerContractSrc), "utf8");
    const srcId = await warpCreateSource(contractSource, wallet, env);

    const initState = {
        "meta": {
          "season": "2022"
        },
        "name": "Tester",
        "orgId": "TEST",
        "owner": "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU",
        "price": 1000000,
        "votes": [],
        "claims": [],
        "scores": [],
        "status": "started",
        "ticker": "TESTER",
        "tokens": [],
        "balances": { "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU": 1 },
        "position": "TEST",
        "settings": [
          [ "quorum", 0.5 ],
          [ "support", 0.51 ],
          [ "voteLength", 2160 ],
          [ "communityLogo", "" ]
        ],
        "claimable": [],
        "ownership": "single",
        "protected": [ "protected", "scores", "purchaseLog", "price" ],
        "purchaseLog": [],
        "divisibility": 1000000,
        "votingSystem": "weighted",
        "beneficiaryId": "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU",
        "priceIncrement": 10000
    };

    // Create player
    const playerId = await warpCreateContractFromTx(srcId, initState, wallet, env);

    return playerId;
}

const env = "DEV";
let contractId = await deploy(env);
console.log(contractId);

console.log(await warpRead(contractId, env, false));
