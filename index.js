import dotenv from "dotenv";
import { Alchemy, Network } from "alchemy-sdk";
import fs from "fs";
import { table } from "table";
import PQueue from "p-queue";
import cliProgress from "cli-progress";
dotenv.config();

const { ALCHEMY_API_KEY, NETWORK } = process.env;
let config;
if (ALCHEMY_API_KEY && NETWORK) {
  config = {
    apiKey: ALCHEMY_API_KEY,
    network: Network[NETWORK],
  };
} else {
  console.log("Please add ALCHEMY_API_KEY and NETWORK to .env");
  process.exit(1);
}
const alchemy = new Alchemy(config);

function validateAddress(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false;
  } else {
    return true;
  }
}

function readFileAsArray(fileName) {
  try {
    const fileContent = fs.readFileSync(fileName).toString();
    return fileContent.split("\n");
  } catch (error) {
    console.error(`Error reading file ${fileName}: ${error}`);
    return null;
  }
}

function writeFile(fileName, data) {
  try {
    fs.writeFileSync(fileName, data);
    console.log(`File ${fileName} is written successfully.`);
  } catch (error) {
    console.error(`Error writing file ${fileName}: ${error}`);
  }
}

const fetchData = async (address) => {
  try {
    const nfts = await alchemy.nft.getNftsForOwner(address);
    return {
      address: address,
      NftsTotalCount: nfts.totalCount,
      NFTs: nfts.ownedNfts,
    };
  } catch (error) {
    console.error(`Error fetching data for address ${address}: ${error}`);
  }
};

function processData(data) {
  let resultTable = [["Address", "Total", "NFTs"]];
  for (const addressData of data) {
    let result = [];
    result.push(addressData.address);
    result.push(addressData.NftsTotalCount);
    let NTFsTitles = [];
    for (let nft of addressData.NFTs) {
      if (nft.title != "") {
        let nftTitle = nft.title.replace(
          /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g,
          ""
        );
        NTFsTitles.push(nftTitle);
      }
    }
    result.push(NTFsTitles.join("\r\n"));
    resultTable.push(result);
  }
  saveAsCSV(resultTable);
  console.log(table(resultTable));
}

const saveAsCSV = (data) => {
  let result = "";
  for (let row of data) {
    for (let i = 0; i < row.length; i++) {
      result += '"' + row[i].toString().split("\r\n").join(", ") + '",';
    }
    result = result.slice(0, -1);
    result += "\n";
  }
  writeFile("output.csv", result);
};

const runMain = async () => {
  let resultTable = [];
  let invalidAdresses = [];
  const addresses = readFileAsArray("addresses.txt");

  const total = addresses.length;
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(total, 0);

  const queue = new PQueue({ concurrency: 2 });

  let i = 0;
  addresses.forEach((address) => {
    if (!validateAddress(address)) {
      invalidAdresses.push(address);
      return;
    }

    queue.add(async () => {
      try {
        const result = await fetchData(address, bar);
        if (result) {
          resultTable.push(result);
          bar.increment();
        }
      } catch (error) {
        console.error(error);
      }
    });
  });
  await queue.onIdle();
  bar.stop();
  processData(resultTable);
  console.log("Invalid adressess: ");
  console.log(invalidAdresses);
};

runMain();
