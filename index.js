import dotenv from "dotenv";
import { Alchemy, Network } from "alchemy-sdk";
import fs from "fs";
import { table } from "table";
import PQueue from "p-queue";
import cliProgress from "cli-progress";
dotenv.config();

const createConfig = () => {
  const { ALCHEMY_API_KEY, NETWORK } = process.env;
  if (!ALCHEMY_API_KEY || !NETWORK) {
    console.error("Please add ALCHEMY_API_KEY and NETWORK to .env");
    process.exit(1);
  }
  return {
    apiKey: ALCHEMY_API_KEY,
    network: Network[NETWORK],
  };
};
const alchemy = new Alchemy(createConfig());

const validateAddress = (address) => /^0x[a-fA-F0-9]{40}$/.test(address);

const readFileAsArray = async (fileName) => {
  try {
    const fileContent = await fs.promises.readFile(fileName, "utf-8");
    return fileContent.split("\n");
  } catch (error) {
    console.error(`Error reading file ${fileName}: ${error}`);
    return null;
  }
};

const writeFile = async (fileName, data) => {
  try {
    await fs.promises.writeFile(fileName, data);
    console.log(`File ${fileName} is written successfully.\n`);
  } catch (error) {
    console.error(`Error writing file ${fileName}: ${error}\n`);
  }
};

const convertToCsv = (data) => {
  let result = "";
  for (let row of data) {
    for (let i = 0; i < row.length; i++) {
      result += '"' + row[i].toString().split("\r\n").join(", ") + '",';
    }
    result = result.slice(0, -1);
    result += "\n";
  }
  return result;
};

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

const processData = (data) => {
  let resultTable = [["Address", "Total", "NFTs"]];
  for (const addressData of data) {
    let result = [];
    result.push(addressData.address);
    result.push(addressData.NftsTotalCount);
    let NTFsTitles = [];
    for (let nft of addressData.NFTs) {
      if (nft.title != "") {
        //Clear emoji from NFT Title
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
  return resultTable;
};

const main = async () => {
  let resultTable = [];
  let invalidAdresses = [];
  const addresses = await readFileAsArray("addresses.txt");

  const total = addresses.length;
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(total, 0);
  const queue = new PQueue({ concurrency: 2 });

  for (const address of addresses) {
    if (validateAddress(address)) {
      queue.add(async () => {
        const addressData = await fetchData(address);
        resultTable.push(addressData);
      });
    } else {
      invalidAdresses.push(address);
    }
    bar.increment();
  }
  await queue.onIdle();
  bar.stop();
  return { resultTable, invalidAdresses };
};

const { resultTable, invalidAdresses } = await main();
console.log(table(processData(resultTable)));
await writeFile("output.csv", convertToCsv(processData(resultTable)));
console.log("Invalid addresses:", invalidAdresses);
