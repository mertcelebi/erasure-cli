#!/usr/bin/env node
require("dotenv").config();

import program from "commander";
import Web3 from "web3";
import Contracts from "./Contracts";
import * as nacl from "tweetnacl";
import * as crypto from "./crypto";
import * as ipfs from "./ipfs";
import BN from "bn.js";

const HDWalletProvider = require("truffle-hdwallet-provider");

program
  .command("create")
  .description("Create an erasure competition")
  .action(async () => {
    try {
      const provider = new HDWalletProvider(
        process.env.MNEMONIC,
        process.env.JSON_RPC_URL
      );
      const web3 = new Web3(provider);
      const contracts = await Contracts.build(web3);
      const accounts = await web3.eth.getAccounts();
      const { publicKey, secretKey } = nacl.box.keyPair();
      const start = Math.floor(new Date().getTime() / 1000) + 30; // starts in 30 seconds
      const ipfsHash = await ipfs.addJson({
        name: "Test competition"
      });

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
      const promise = contracts.daily.methods
        .createRound(
          accounts[0],
          crypto.bytesToHex(publicKey),
          new BN(3),
          new BN(start),
          new BN(start + 3600), // 1 hour
          new BN(start + 3600 * 24), // 24 hours
          web3.utils.toWei(new BN(10), "ether"), // 10 ERASE
          crypto.bytesToHex(crypto.base58ToBytes(ipfsHash))
        )
        .send({
          from: accounts[0]
        })
        .on("transactionHash", (hash: string) => {
          console.log("Transaction hash: ", hash);
        })
        .on("confirmation", () => {
          console.log("Confirmed.");
        });

      await promise;

      console.log("Secret reveal key: ", crypto.bytesToHex(secretKey));
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    //   function createRound(
    //   address _oracle,
    //   uint256 _publicKey,
    //   uint8 _optionCount,
    //   uint40 _startsAt,
    //   uint40 _closesAt,
    //   uint40 _revealsAt,
    //   uint256 _reward,
    //   bytes _ipfsMultiHash
    // )
  });

program.parse(process.argv);
