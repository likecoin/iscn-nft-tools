// eslint-disable-next-line import/no-extraneous-dependencies
const Long = require('long');
const { createProtobufRpcClient } = require('@cosmjs/stargate');
const {
  QueryClientImpl,
} = require('@likecoin/iscn-message-types/dist/iscn/query');

function setupISCNExtension(base) {
  const rpc = createProtobufRpcClient(base);
  const queryService = new QueryClientImpl(rpc);
  return {
    iscn: {
      recordsById: (iscnId, fromVersion = 0, toVersion = 0) => queryService.RecordsById({
        iscnId,
        fromVersion: Long.fromNumber(fromVersion, true),
        toVersion: Long.fromNumber(toVersion, true),
      }),
      recordsByFingerprint: (fingerprint, fromSequence = 0) => queryService.RecordsByFingerprint({
        fingerprint,
        fromSequence: Long.fromNumber(fromSequence, true),
      }),
      recordsByOwner: (owner, fromSequence = 0) => queryService.RecordsByOwner({
        owner, fromSequence: Long.fromNumber(fromSequence, true),
      }),
      params: () => queryService.Params({}),
      getCid: (cid) => queryService.GetCid({ cid }),
      hasCid: (cid) => queryService.HasCid({ cid }),
      getCidSize: (cid) => queryService.GetCidSize({ cid }),
    },
  };
}

module.exports = {
  setupISCNExtension,
};
