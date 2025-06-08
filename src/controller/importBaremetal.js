import { connectWithMongoose } from "../config/mongoConnection.js";
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';

const { MAAS_API_URL, MAAS_API_KEY,PROVIDERNAME,FLAVOR_NAME, USER_TANENT,AZ,USER_PROJECT,USER_ID,ARCH} = process.env;

const [consumerKey, token, tokenSecret] = MAAS_API_KEY.split(':');

// OAuth setup
const oauth = new OAuth({
  consumer: { key: consumerKey, secret: '' },
  signature_method: 'PLAINTEXT',
  hash_function: (base_string, key) => key,
});

// Mongoose Schema
const BaremetalServerSchema = new mongoose.Schema({
  _id: {
    domain: String,
    project: String,
    name: String,
    availabilityZone: String,
  },
  key: {
    domain: String,
    project: String,
    name: String,
    availabilityZone: String,
  },
  id: Buffer, // BinData
  pConfig: {
    flavor: String,
  },
  serverInfo: {
    system_id: String,
    hostname: String,
    arch: String,
    cpu: Number,
    mem: Number,
    vmhost_id: Number,
    IpAddr: [String],
    serial: String,
    rootVolumeSize: Number,
  },
  osImage: String,
  createTime: Number,
  createdBy: String,
  cloudInit: String,
  provider: String,
  status: Number,
  powerStatus: Number,
}, { collection: 'baremetal-servers' });

const BaremetalServer = mongoose.model('BaremetalServer', BaremetalServerSchema);

// Main function
const createRequest = async () => {
  const url = `${MAAS_API_URL}/api/2.0/machines/`;
  const requestData = { url, method: 'GET' };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, {
    key: token,
    secret: tokenSecret,
  }));

  try {
    const response = await axios.get(url, {
      headers: {
        ...authHeader,
        Accept: 'application/json',
      },
    });

    const poolName = FLAVOR_NAME;
    const deployedMachines = response.data.filter(machine =>
      machine.pool?.name === poolName && machine.status_name === 'Deployed'
    );

    console.log(`📦 Found ${deployedMachines.length} deployed machine(s) in pool "${poolName}"`);

    for (const machine of deployedMachines) {
      const domain = USER_TANENT;
      const project = USER_PROJECT;
      const name = machine.hostname || machine.system_id;
      const availabilityZone = AZ;

      const serverInfo = {
        system_id: machine.system_id,
        hostname: machine.hostname,
        arch: ARCH || machine.architecture || 'amd64',
        cpu: machine.cpu_count,
        mem: machine.memory,
        vmhost_id: machine.vm_host ? parseInt(machine.vm_host) : 0,
        IpAddr: machine.ip_addresses || [],
        serial: machine.serial || 'Unknown',
        rootVolumeSize: machine.storage ? machine.storage[0]?.size || 0 : 0
      };

      // 🚫 Check if system_id already exists
      const existing = await BaremetalServer.findOne({ 'serverInfo.system_id': serverInfo.system_id });
      if (existing) {
        console.log(`⚠️ Skipped (already exists): ${name} (${serverInfo.system_id})`);
        continue;
      }

      const record = {
        _id: { domain, project, name, availabilityZone },
        key: { domain, project, name, availabilityZone },
        id: randomBytes(16), // BinData(0, '...')
        pConfig: { flavor: poolName },
        serverInfo,
        osImage: machine.osystem || 'ubuntu/jammy',
        createTime: Math.floor(Date.now() / 1000),
        createdBy: USER_ID,
        cloudInit: '',
        provider: PROVIDERNAME,
        status: 4,
        powerStatus: machine.power_state === 'on' ? 1 : 0
      };

      await BaremetalServer.updateOne(
        { _id: record._id },
        { $set: record },
        { upsert: true }
      );

      console.log(`✅ Imported: ${name}`);
    }

  } catch (error) {
    console.error('❌ Error fetching machines:', error.response?.data || error.message);
  }
};

// Entry point
const importBaremetal = async () => {
  await connectWithMongoose();
  await createRequest();
};

export default importBaremetal;
