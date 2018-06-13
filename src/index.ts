#!/usr/bin/env node
require("dotenv").config();

import program from "commander";
import Web3 from "web3";
import Contracts, { Prediction } from "./Contracts";
import * as nacl from "tweetnacl";
import * as crypto from "./crypto";
import * as ipfs from "./ipfs";
import BN from "bn.js";
import Merkle from "erasure-merkle";

const HDWalletProvider = require("truffle-hdwallet-provider");

function parseTime(timeStr: string): number {
  let matches;
  if ((matches = timeStr.match(/([0-9]+)s/))) {
    // Seconds
    return parseInt(matches[1]);
  }
  if ((matches = timeStr.match(/([0-9]+)m/))) {
    // Minutes
    return parseInt(matches[1]) * 60;
  }
  if ((matches = timeStr.match(/([0-9]+)h/))) {
    // Hours
    return parseInt(matches[1]) * 3600;
  }
  return parseInt(timeStr);
}

interface Round {
  roundId: string;
}

program
  .command("create")
  .description("Create an erasure competition")
  .option("-s, --starts <time>", "Starts at (default 30s)", parseTime, 30)
  .option(
    "-c, --closes <time>",
    "Closes at, difference from start (default 1h)",
    parseTime,
    3600
  )
  .option(
    "-r, --reveals <erase>",
    "Reveals at, difference from start (default 24h)",
    parseTime,
    24 * 3600
  )
  .option("-w, --reward <time>", "Reward in ERASE (default 10)", parseInt, 10)
  .action(
    async (options: {
      starts: number;
      closes: number;
      reveals: number;
      reward: number;
    }) => {
      try {
        const provider = new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.JSON_RPC_URL
        );
        const web3 = new Web3(provider);
        const contracts = await Contracts.build(web3);
        const accounts = await web3.eth.getAccounts();
        const ipfsHash = await ipfs.addJson({
          name: "Test competition"
        });
        const { publicKey, secretKey } = nacl.box.keyPair();
        const start = Math.floor(new Date().getTime() / 1000) + options.starts;

        console.log(ipfsHash);

        console.log("Unlocking ERASE...");
        await new Promise(resolve => {
          contracts.erase.methods
            .approveAll(contracts.daily._address)
            .send({
              from: accounts[0]
            })
            .on("transactionHash", (hash: string) => {
              console.log("Transaction hash: ", hash);
            })
            .on("receipt", resolve)
            .on("confirmation", () => {
              console.log("Confirmed.");
            });
        });

        console.log("Sending transaction...");

        const round = await new Promise<Round>(resolve => {
          contracts.daily.methods
            .createRound(
              accounts[0],
              crypto.bytesToBn(publicKey),
              new BN(3),
              new BN(start),
              new BN(start + options.closes),
              new BN(start + options.reveals),
              web3.utils.toWei(new BN(options.reward), "ether"),
              crypto.bytesToHex(crypto.base58ToBytes(ipfsHash))
            )
            .send({
              from: accounts[0]
            })
            .on("transactionHash", (hash: string) => {
              console.log("Transaction hash: ", hash);
            })
            .on("receipt", (receipt: any) => {
              resolve(receipt.events.RoundCreation.returnValues);
            })
            .on("confirmation", () => {
              console.log("Confirmed.");
            });
        });

        console.log("To reveal: ");
        console.log(
          `erasure reveal -r ${round.roundId} -s ${crypto.bytesToHex(
            secretKey
          )} -w [WINNING PREDICTION]`
        );
        process.exit(0);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
  );

program
  .command("reveal")
  .description("Reveal results from an erasure competition")
  .option("-s, --secret <hex>", "Secret key (in hex)", /0x[0-9a-f]{64}/)
  .option("-r, --round <id>", "Round ID", /[0-9]+/)
  .option("-w, --winner <id>", "Index of winning bucket", /[0-9]+/)
  .action(
    async (options: { secret: string; round: string; winner: string }) => {
      try {
        const provider = new HDWalletProvider(
          process.env.MNEMONIC,
          process.env.JSON_RPC_URL
        );
        const web3 = new Web3(provider);
        const contracts = await Contracts.build(web3);
        const accounts = await web3.eth.getAccounts();

        const roundId = new BN(options.round);

        const { publicKey, secretKey } = nacl.box.keyPair.fromSecretKey(
          crypto.hexToBytes(options.secret)
        );

        const round = await contracts.daily.methods.getRound(roundId).call();

        if (
          crypto.bytesToHex(publicKey) !==
          crypto.bytesToHex(crypto.bnToBytes(new BN(round.publicKey), 32))
        ) {
          console.log("Error: wrong secret key");
          process.exit(1);
        }

        const predictionIds = await contracts.daily.methods
          .getPredictionsPerRound(roundId)
          .call();

        const predictions = await Promise.all(
          predictionIds.map(id => {
            return contracts.daily.methods.getPrediction(id).call();
          })
        );

        for (let prediction of predictions) {
          const encrypted = crypto.bnToBytes(
            new BN(prediction.encryptedPrediction),
            17
          );
          const publicKey = crypto.bnToBytes(
            new BN(prediction.userPublicKey),
            32
          );
          const nonce = crypto.bnToBytes(new BN(prediction.nonce), 24);
          const decrypted = crypto.decryptPredictionForRound(
            encrypted,
            nonce,
            publicKey,
            secretKey
          );
          console.log("Pushing prediction into bucket", decrypted);
          prediction.prediction = decrypted;
        }

        const winners = predictions.filter(
          p => p.prediction === parseInt(options.winner)
        );
        const losers = predictions.filter(
          p => p.prediction !== parseInt(options.winner)
        );
        console.log(
          "Counted",
          winners.length,
          "winning and",
          losers.length,
          "losing predictions."
        );

        const totalStakedByWinners = winners
          .map(p => new BN(p.stake))
          .reduce((sum, stake) => sum.add(stake), new BN(0));
        const totalStakedByLosers = losers
          .map(p => new BN(p.stake))
          .reduce((sum, stake) => sum.add(stake), new BN(0));

        const winningTree = Merkle.build(winners.map(p => p.user));
        const losingTree = Merkle.build(losers.map(p => p.user));

        const winningOption = new BN(options.winner);

        console.log({
          roundId,
          revealSecret: crypto.bytesToBn(secretKey),
          winningOption,
          totalStakedByWinners,
          totalStakedByLosers,
          winningMerkleRoot: "0x" + winningTree.rootHash,
          losingMerkleRoot: "0x" + losingTree.rootHash,
          from: accounts[0]
        });

        const result = await new Promise<{ roundId: string }>(resolve => {
          contracts.daily.methods
            .updateRoundResults(
              roundId,
              crypto.bytesToBn(secretKey),
              winningOption,
              totalStakedByWinners,
              totalStakedByLosers,
              "0x" + winningTree.rootHash,
              "0x" + losingTree.rootHash
            )
            .send({
              from: accounts[0]
            })
            .on("transactionHash", (hash: string) => {
              console.log("Transaction hash: ", hash);
            })
            .on("receipt", (receipt: any) => {
              resolve(receipt.events.RoundResultsUpdate.returnValues);
            })
            .on("confirmation", () => {
              console.log("Confirmed.");
            });
        });

        console.log("Successfully revealed round", result.roundId);

        process.exit(0);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
  );

program.parse(process.argv);
