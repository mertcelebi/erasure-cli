import nacl from "tweetnacl";
import util from "tweetnacl-util";
import { keccak256 } from "js-sha3";
import bs58 from "bs58";
import BN from "bn.js";

export function bnToBytes(bn: BN, length: number) {
  const zeros = new Array(length).fill("00").join("");
  return hexToBytes((zeros + bn.toString(16)).slice(-length * 2));
}

export function bytesToBn(bytes: Uint8Array) {
  return new BN(bytesToHex(bytes).substring(2), 16);
}

// Convert a hex string to a byte array
export function hexToBytes(hex: string) {
  if (hex.indexOf("0x") === 0) hex = hex.substring(2);

  const length = hex.length / 2;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array) {
  let hex = "0x";

  for (let i = 0; i < bytes.length; i++) {
    // We need to pad the hex digit with 0
    hex += ("0" + bytes[i].toString(16)).slice(-2);
  }

  return hex;
}

// Convert a base58 string to a byte array
export function base58ToBytes(base58: string) {
  const bytes = new Uint8Array(bs58.decode(base58));
  return bytes;
}

export function bytesToBase58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

export function hexArrayToBytes(hexArray: string[]) {
  return new Uint8Array(hexArray.map(hex => parseInt(hex.substring(2), 16)));
}

export function bytesToHexArray(bytes: Uint8Array) {
  return Array.from(bytes).map(x => "0x" + x.toString(16));
}

function concat(array1: Uint8Array, array2: Uint8Array) {
  const newArray = new Uint8Array(array1.length + array2.length);
  newArray.set(array1);
  newArray.set(array2, array1.length);
  return newArray;
}

function sha3(bytes: Uint8Array) {
  hexToBytes(keccak256(bytes));
}

export function createNonce() {
  return nacl.randomBytes(24);
}

export function buildMessageSecret(
  nonce: Uint8Array,
  sellerSecret: Uint8Array
) {
  return sha3(concat(nonce, sellerSecret));
}

export function encryptPredictionForRound(
  prediction: number,
  nonce: Uint8Array,
  roundPublicKey: Uint8Array,
  predictorSecretKey: Uint8Array
) {
  const dataBytes = new Uint8Array([prediction]);
  return nacl.box(dataBytes, nonce, roundPublicKey, predictorSecretKey);
}

export function decryptPredictionForRound(
  data: Uint8Array,
  nonce: Uint8Array,
  predictorPublicKey: Uint8Array,
  roundSecretKey: Uint8Array
): null | number {
  const decrypted = nacl.box.open(
    data,
    nonce,
    predictorPublicKey,
    roundSecretKey
  );
  return decrypted ? decrypted[0] : null;
}

export function encryptMessage(
  obj: Object,
  nonce: Uint8Array,
  secret: Uint8Array
) {
  const dataBytes = util.decodeUTF8(JSON.stringify(obj));
  return nacl.secretbox(dataBytes, nonce, secret);
}

export function decryptMessage(
  data: Uint8Array,
  nonce: Uint8Array,
  secret: Uint8Array
) {
  const decrypted = nacl.secretbox.open(data, nonce, secret);
  return JSON.parse(util.encodeUTF8(decrypted));
}

export function encryptSecretForBuyer(
  messageSecret: Uint8Array,
  nonce: Uint8Array,
  buyerPublicKey: Uint8Array,
  sellerSecretKey: Uint8Array
) {
  return nacl.box(messageSecret, nonce, buyerPublicKey, sellerSecretKey);
}

export function decryptSecretForBuyer(
  messageSecret: Uint8Array,
  nonce: Uint8Array,
  sellerPublicKey: Uint8Array,
  buyerSecretKey: Uint8Array
) {
  return nacl.box.open(messageSecret, nonce, sellerPublicKey, buyerSecretKey);
}
