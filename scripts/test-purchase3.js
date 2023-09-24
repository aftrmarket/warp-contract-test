import fs, { read } from "fs";
import path from "path";
import { arweaveInit, warpInit, warpCreateNewContract, warpCreateContractFromTx, warpRead, warpWrite, warpCreateSource } from "../utils/warp.js";

const arweave = arweaveInit("DEV");

const __dirname = path.resolve();
const mine = () => arweave.api.get("mine");

const updateContractFile = (regId, contractType, placeholderName) => {
    const contractFilePath = path.join(__dirname, "contracts", "sources", contractType, "contract-source.js");

    try {
        let fileContent = fs.readFileSync(contractFilePath, "utf8");

        // Replace the placeholder with the regId value
        const placeholder = placeholderName;
        fileContent = fileContent.replace(placeholder, regId);

        fs.writeFileSync(contractFilePath, fileContent);

        console.log(`Updated contract file: ${contractFilePath}`);
    } catch (error) {
        console.error(`Failed to update contract file: ${contractFilePath}`, error);
    }
};

const copyFile = (sourcePath, destinationPath) => {
    try {
        // Read the content of the source file
        const fileContent = fs.readFileSync(sourcePath);

        // Write the content to the destination file, overwriting it if it exists
        fs.writeFileSync(destinationPath, fileContent);

        console.log(`Copied ${sourcePath} to ${destinationPath}`);
    } catch (error) {
        console.error(`Failed to copy ${sourcePath} to ${destinationPath}`, error);
    }
};

async function deploy(createCurrency = true, env = "DEV") {
    const contracts = {
        gameCurrentId: "",
        playerRegistryId: "",
        playerSourceId: "",
        teamSourceId: ""
    };

    const gameCurrentContractSrc = "/contracts/contract-work.js";
    const gameCurrencyInitState = {
        "name" : "Work",
        "ticker" : "WORK",
        "balances" : {},
        "vault" : {},
        "claimable": [],
        "claims": [],
        "evolve": "",
        "settings" : [
            [ "quorum", 0.5 ],
            [ "support", 0.5],
            [ "voteLength", 2000 ],
            [ "communityAppUrl", "" ],
            [ "communityDiscussionLinks", "" ],
            [ "communityDescription", "Test currency." ],
            [ "communityLogo", "iLPUUQvjA0jPH9VGjTsMkaxBbh_WnwRuqp6WhE_M3Ag"]
        ]
    };

    const playerRegContractSrc = "/contracts/contract-player-reg.js";
    const playerContractSrc= "/contracts/builds/contract-player.js";
    const teamContractSrc= "/contracts/builds/contract-team.js";

    const wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "./dev/test-wallet.json")));
    const walletAddr = await arweave.wallets.getAddress(wallet);

    // Airdrop amount of tokens (in winston) to wallet
    if (env === "DEV") {
        await arweave.api.get(`mint/${walletAddr}/10000000000000000`);
        await mine();
    }

    // Player Registry
    let contractSource = fs.readFileSync(path.join(__dirname, playerRegContractSrc), "utf8");
    let initState = {
        register: [], 
        season: "2023"
    };
    contracts.playerRegistryId = await warpCreateNewContract(contractSource, initState, wallet, env);
    console.log("*** Player Reg ID: " + contracts.playerRegistryId);

    // Create currency
    if (createCurrency) {
        // Create Work Token
        console.log("*** Creating Work Token.");
        const contractSource = fs.readFileSync(path.join(__dirname, gameCurrentContractSrc), "utf8");
        contracts.gameCurrentId = await warpCreateNewContract(contractSource, gameCurrencyInitState, wallet, env);
    }

    // Copy source files and update placeholders
    let contractType = "player";
    let srcPath = path.join(__dirname, "contracts", "sources", contractType, "contract-source.js");
    let destPath = path.join(__dirname, "contracts", `builds/contract-${contractType}.js`);
    copyFile(srcPath, destPath);
    updateContractFile(contracts.gameCurrentId, "player", "<GAME CURRENCY PLACEHOLDER>");
    updateContractFile(contracts.playerRegistryId, "player", "<PLAYER REGISTRY PLACEHOLDER>");

    contractType = "team";
    srcPath = path.join(__dirname, "contracts", "sources", contractType, "contract-source.js");
    destPath = path.join(__dirname, "contracts", `builds/contract-${contractType}.js`);
    copyFile(srcPath, destPath);
    updateContractFile(contracts.gameCurrentId, "team", "<GAME CURRENCY PLACEHOLDER>");
    updateContractFile(contracts.playerRegistryId, "team", "<PLAYER REGISTRY PLACEHOLDER>");

    // Create sources
    contractSource = fs.readFileSync(path.join(__dirname, playerContractSrc), "utf8");
    contracts.playerSourceId = await warpCreateSource(contractSource, wallet);

    contractSource = fs.readFileSync(path.join(__dirname, teamContractSrc), "utf8");
    contracts.teamSourceId = await warpCreateSource(contractSource, wallet);

    return contracts;
}


let contracts = await deploy(true, "DEV");

console.log(JSON.stringify(contracts));
