import AdmZip from 'adm-zip';
import { createCanvas, loadImage, Image } from 'canvas';
import { load } from 'cheerio';
import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';
import fs from 'fs';
import QRCode from 'qrcode';
import path from 'path';

import * as config from './config.js';

const { IS_TESTNET } = process.env;
const APP_LIKE_CO_URL = IS_TESTNET ? 'https://app.rinkeby.like.co' : 'https://app.like.co';

const LIKE_GREEN = '#28646e';
const QR_CODE_SIZE = 256;
const LOGO_SIZE = 64;

const INPUT_FOLDER = 'input';
const OUTPUT_FOLDER = 'output';
const ASSET_FOLDER = 'asset';
const LIKECOIN_LOGO_PNG = 'LikeCoin-logo.png';
const ISCN_XHTML = 'iscn.xhtml';
const ISCN_CSS = 'iscn.css';
const ISCN_LIST_CSV = `list.csv`;
const ISCNQRCodePNG = 'iscn-qr-code.png';

function getISCNPrefix(input) {
  const res = /^(iscn:\/\/likecoin-chain\/[A-Za-z0-9-_]+)(?:\/([0-9]*))?$/.exec(input);
  if (!res) throw new Error(`Invalid ISCN ID ${input}`);
  const [, prefix] = res;
  return prefix;
}

function loadISCNList() {
  const string = fs.readFileSync(ISCN_LIST_CSV).toString();
  const records = parse(string, {
    columns: true,
    skip_empty_lines: true,
  });
  return records;
}

function unzipEpub(epubPath, outputFolder) {
  const basename = path.basename(epubPath, '.epub');
  const unzippedFolderName = `${basename}_temp`;
  const unzippedFolderPath = `${outputFolder}/${unzippedFolderName}`;
  const unzip = new AdmZip(epubPath);
  unzip.extractAllTo(unzippedFolderPath, true);
  return { unzippedFolderPath, basename };
}

function getISCNURL(iscnPrefix) {
  return `${APP_LIKE_CO_URL}/view/${encodeURIComponent(iscnPrefix)}`;
}

async function createQRCodeCanvas(iscnPrefix) {
  const iscnURL = getISCNURL(iscnPrefix);
  const logoImage = await loadImage(`${ASSET_FOLDER}/${LIKECOIN_LOGO_PNG}`);
  const initQRCode = await QRCode.toDataURL(iscnURL, {
    color: {
      dark: LIKE_GREEN,
    },
    errorCorrectionLevel: 'H',
    margin: 2,
  });
  const canvas = createCanvas(QR_CODE_SIZE, QR_CODE_SIZE);
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.src = initQRCode;
  ctx.drawImage(img, 0, 0, QR_CODE_SIZE, QR_CODE_SIZE);

  const logoPosition = (canvas.width - LOGO_SIZE) / 2;

  // draw blank white square
  ctx.fillStyle = '#fff';
  ctx.fillRect(logoPosition, logoPosition, LOGO_SIZE, LOGO_SIZE);

  // draw logo
  ctx.drawImage(logoImage, logoPosition, logoPosition, LOGO_SIZE, LOGO_SIZE);

  return canvas;
}

/**
 * @param {Canvas} canvas
 * @param {string} path
 * @returns {Promise<void>} 
 * @throws {Error}
 */
function saveCanvas(canvas, path) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(path);
    const stream = canvas.createPNGStream();
    stream.pipe(fileStream);
    stream.on('error', reject);
    fileStream.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

/**
 * @param {CheerioAPI} opf$ $ of content.opf
 * @param {string} iscnPageHref path to ISCN page
 * @param {string} iscnQRCodeHref path to ISCN QR code image
 */
function updateContentOPF(opf$, iscnPageHref, iscnQRCodeHref) {
  const manifest = opf$('manifest');
  manifest.append(`  <item id="a" href="iscn.css" media-type="text/css" />\n  `);
  manifest.append(`  <item id="b" href="${iscnQRCodeHref}" media-type="image/png" />\n  `);
  manifest.append(`  <item id="iscn-page" href="${iscnPageHref}" media-type="application/xhtml+xml" />\n  `);

  const spine = opf$('spine');
  spine.append(`  <itemref idref="iscn-page" />\n  `);
}

/**
 * @param {CheerioAPI} opf$ $ of content.opf
 * @return {Map<string, string>} map of info item
 */
function readInfoMap(opf$) {
  const title = opf$('metadata dc\\:title').text();
  const author = opf$('metadata dc\\:creator').first().text();
  const releaseDate = dayjs(new Date()).format(config.DATE_FORMAT);
  const map = new Map();
  map.set(config.TITLE_LABEL, title);
  map.set(config.AUTHOR_LABEL, author);
  map.set(config.RELEASE_DATE_LABEL, releaseDate);
  return map;
}

/**
 * @param {CheerioAPI} xhtml$
 * @param {string} htmlToAppend
 */
function addBookInfo(xhtml$, infoItemMap) {
  const div = xhtml$('body > div#iscn-page-book-info');
  const itemsString = [...infoItemMap]
    .filter(([key, value]) => key && value)
    .map(([key, value]) => (
      `    <p><strong>${key}</strong>: ${value}</p>\n`
    ))
    .join('');
  div.append(itemsString);
}

function setISCNLink(xhtml$, iscnPrefix) {
  const a = xhtml$('body > a#iscn-prefix');
  const iscnURL = getISCNURL(iscnPrefix);
  a.attr('href', iscnURL);
  a.text(iscnPrefix);
}

function addDepubDisclaimer(xhtml$) {
  const p = xhtml$('body > p#depub-disclaimer');
  p.text(config.DEPUB_DISCLAIMER);
}

/**
 * @param {string} epubPath
 * @param {string} iscnPrefix
 * @param {string} outputFolder
 */
async function addISCNQRCode(epubPath, iscnPrefix, outputFolder = OUTPUT_FOLDER) {
  // unzip
  const { unzippedFolderPath, basename } = unzipEpub(epubPath, outputFolder);
  
  try {
    // create QR code
    const canvas = await createQRCodeCanvas(iscnPrefix);
    const oebpsPath = `${unzippedFolderPath}/OEBPS`;
    await saveCanvas(canvas, `${oebpsPath}/${ISCNQRCodePNG}`);

    // read and update content.opf
    const opfPath = `${oebpsPath}/content.opf`;
    const opfString = fs.readFileSync(opfPath, 'utf-8');
    const opf$ = load(opfString, {
      xmlMode: true,
      decodeEntities: false,
    });
    updateContentOPF(opf$, ISCN_XHTML, ISCNQRCodePNG);
    const infoMap = readInfoMap(opf$);
    const updatedOpfString = opf$.xml();
    fs.writeFileSync(opfPath, updatedOpfString, 'utf-8');

    // add ISCN css
    fs.copyFileSync(`${ASSET_FOLDER}/${ISCN_CSS}`, `${oebpsPath}/${ISCN_CSS}`);

    // add ISCN XHTML and update info
    const iscnXHTMLPath = `${oebpsPath}/${ISCN_XHTML}`;
    fs.copyFileSync(`${ASSET_FOLDER}/${ISCN_XHTML}`, iscnXHTMLPath);
    const iscnXHTMLString = fs.readFileSync(iscnXHTMLPath, 'utf-8');
    const iscnXHTML$ = load(iscnXHTMLString, {
      xmlMode: true,
      decodeEntities: false,
    });
    addBookInfo(iscnXHTML$, infoMap);
    setISCNLink(iscnXHTML$, iscnPrefix);
    addDepubDisclaimer(iscnXHTML$);
    const updatedISCNXHTMLString = iscnXHTML$.xml();
    fs.writeFileSync(iscnXHTMLPath, updatedISCNXHTMLString, 'utf-8');

    // zip
    const epubFilename = path.basename(epubPath);
    const zip = new AdmZip();
    zip.addLocalFolder(unzippedFolderPath);
    zip.writeZip(`${outputFolder}/${epubFilename}`);
    console.log(`[Added ISCN QR Code] ${basename}`);
  } catch (error) {
    console.error(`[Error] Cannot add ISCN to ${basename}`);
    throw error;
  } finally {
    fs.rmSync(unzippedFolderPath, { recursive: true });
  }
}

async function run() {
  const records = loadISCNList();

  for (const record of records) {
    const { filename, iscnId } = record;

    const epubPath = `${INPUT_FOLDER}/${filename}.epub`;
    if (!fs.existsSync(epubPath)) {
      console.error(`[Error] ${filename} not found in input folder`);
      continue;
    }

    if (!iscnId) {
      console.error(`[Error] ISCN prefix undefined for ${filename}`);
      continue;
    }

    const iscnPrefix = getISCNPrefix(iscnId);
    await addISCNQRCode(epubPath, iscnPrefix);
  }
}

run();