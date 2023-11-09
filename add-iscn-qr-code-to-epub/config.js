import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat.js';
import 'dayjs/locale/en.js';
import 'dayjs/locale/zh-hk.js';
import 'dayjs/locale/zh-tw.js';

dayjs.extend(LocalizedFormat);

const language = 'en'; // en, zh-hk, zh-tw
dayjs.locale(language);

const config = {
  'en': {
    TITLE_LABEL: 'Title',
    AUTHOR_LABEL: 'Author',
    RELEASE_DATE_LABEL: 'Release date',
    DATE_FORMAT: 'LL', // equals to 'MMMM D, YYYY' (August 16, 2018)
    DEPUB_DISCLAIMER: 'This book is published on decentralized networks',
  },
  'zh-hk': {
    TITLE_LABEL: '書名',
    AUTHOR_LABEL: '作者',
    RELEASE_DATE_LABEL: '發行日期',
    DATE_FORMAT: 'LL', // YYYY年M月D日
    DEPUB_DISCLAIMER: '此書採用分散式出版',
  },
  'zh-tw': {
    TITLE_LABEL: '書名',
    AUTHOR_LABEL: '作者',
    RELEASE_DATE_LABEL: '發行日期',
    DATE_FORMAT: 'LL', // YYYY年M月D日
    DEPUB_DISCLAIMER: '此書採用分散式出版',
  },
};

export const {
  TITLE_LABEL,
  AUTHOR_LABEL,
  RELEASE_DATE_LABEL,
  DATE_FORMAT,
  DEPUB_DISCLAIMER,
} = config[language] || config.en;
