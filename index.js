import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import { Alchemy, Network } from "alchemy-sdk";
import fs from "fs";

let addresses = fs.readFileSync("addresses.txt").toString().split("\n");

// console.log(process.env.ALCHEMY_API_KEY);
let config ={}
if (process.env.ALCHEMY_API_KEY && process.env.NETWORK){
  const NETWORK = process.env.NETWORK
  config = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network[NETWORK],
  };
} else {
  console.log("Please add ALCHEMY_API_KEY and NETWORK to .env");
  process.exit(1)
}
const alchemy = new Alchemy(config);


// Fetch all the NFTs owned by address
const main = async (address) => {
  // Get all NFTs
  const nfts = await alchemy.nft.getNftsForOwner(address);
  // Print NFTs
  if (nfts.ownedNfts) {
    console.log(`${address} have ${nfts.totalCount} NFTs: `);
    for (const nft of nfts.ownedNfts) {
      console.log(nft.title);
    }
  }
  console.log("=========================================================\n");
  return { address: address, NftsTotalCount: nfts.totalCount };
};

// Execute the code
const runMain = async () => {
  let resultTable = [];

  for (const address of addresses) {
    try {
      const result = await main(address);
      resultTable.push(result);
    } catch (error) {
      console.log(error);
    }
  }
  console.table(resultTable);
  process.exit(0);
};

runMain();
