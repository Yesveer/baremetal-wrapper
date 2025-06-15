import { connectWithMongoose } from "../config/mongoConnection.js";
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import { Binary } from 'bson';
import { v4 as uuidv4 } from 'uuid';

const { MAAS_API_URL, MAAS_API_KEY, PROVIDERNAME, FLAVOR_NAME, USER_TANENT, AZ, USER_PROJECT, USER_ID, ARCH } = process.env;

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

// Function to add workload annotations to MAAS machine
// const addWorkloadAnnotations = async (systemId, domain, name, project) => {
//   const url = `${MAAS_API_URL}/api/2.0/machines/${systemId}/op-set_workload_annotations`;
  
//   // MAAS uses tags for annotations
//   const tags = [
//     `domain:${domain}`,
//     `name:${name}`,
//     `project:${project}`
//   ];

//   // Create form data for the POST request
//   const formData = new URLSearchParams();
//   tags.forEach(tag => formData.append(tag));

//   const requestData = {
//     url,
//     method: 'POST',
//     data: formData.toString()
//   };

//   const authHeader = oauth.toHeader(oauth.authorize(requestData, {
//     key: token,
//     secret: tokenSecret,
//   }));

//   try {
//     const response = await axios.post(url, requestData.data, {
//       headers: {
//         ...authHeader,
//         'Content-Type': 'application/x-www-form-urlencoded',
//       }
//     });
//     console.log(`🏷️ Successfully added workload annotations to machine ${systemId}`);
//     return true;
//   } catch (error) {
//     console.error(`❌ Failed to add annotations to machine ${systemId}:`, error.response?.data || error.message);
//     return false;
//   }
// };
const addWorkloadAnnotations = async (systemId, domain, name, project) => {
  const url = `${MAAS_API_URL}/api/2.0/machines/${systemId}/op-set_workload_annotations`;
  
  // Create form data for the POST request
  const formData = new URLSearchParams();
  formData.append('domain', domain);
  formData.append('name', name);
  formData.append('project', project);

  const requestData = {
    url,
    method: 'POST',
    data: formData.toString()
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, {
    key: token,
    secret: tokenSecret,
  }));

  try {
    const response = await axios.post(url, requestData.data, {
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });
    console.log(`🏷️ Successfully added workload annotations to machine ${systemId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to add annotations to machine ${systemId}:`, error.response?.data || error.message);
    return false;
  }
};

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

      // Check if system_id already exists
      const existing = await BaremetalServer.findOne({ 'serverInfo.system_id': serverInfo.system_id });
      if (existing) {
        console.log(`⚠️ Skipped (already exists): ${name} (${serverInfo.system_id})`);
        continue;
      }

      const record = {
        _id: { domain, project, name, availabilityZone },
        key: { domain, project, name, availabilityZone },
        id: Buffer.from(uuidv4(null, Buffer.alloc(16))), // BinData(0, '...')
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

      // Add workload annotations to the MAAS machine
      await addWorkloadAnnotations(machine.system_id, domain, name, project);
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


// import { connectWithMongoose } from "../config/mongoConnection.js";
// import axios from 'axios';
// import OAuth from 'oauth-1.0a';
// import crypto from 'crypto';
// import mongoose from 'mongoose';
// import { v4 as uuidv4 } from 'uuid';

// const { MAAS_API_URL, MAAS_API_KEY, PROVIDERNAME, FLAVOR_NAME, USER_TENANT, AZ, USER_PROJECT, USER_ID, ARCH } = process.env;

// const [consumerKey, token, tokenSecret] = MAAS_API_KEY.split(':');

// // OAuth setup
// const oauth = new OAuth({
//   consumer: { key: consumerKey, secret: '' },
//   signature_method: 'PLAINTEXT',
//   hash_function: (base_string, key) => key,
// });

// // Mongoose Schema
// const BaremetalServerSchema = new mongoose.Schema({
//   _id: {
//     domain: String,
//     project: String,
//     name: String,
//     availabilityZone: String,
//   },
//   key: {
//     domain: String,
//     project: String,
//     name: String,
//     availabilityZone: String,
//   },
//   id: Buffer,
//   pConfig: {
//     flavor: String,
//   },
//   serverInfo: {
//     system_id: String,
//     hostname: String,
//     arch: String,
//     cpu: Number,
//     mem: Number,
//     vmhost_id: Number,
//     IpAddr: [String],
//     serial: String,
//     rootVolumeSize: Number,
//   },
//   osImage: String,
//   createTime: Number,
//   createdBy: String,
//   cloudInit: String,
//   provider: String,
//   status: Number,
//   powerStatus: Number,
// }, { 
//   collection: 'baremetal-servers',
//   versionKey: false
// });

// const BaremetalServer = mongoose.model('BaremetalServer', BaremetalServerSchema);

// // MAAS API Helper
// const makeMaasRequest = async (method, endpoint, data = null) => {
//   const url = `${MAAS_API_URL}${endpoint}`;
  
//   const requestData = {
//     url,
//     method,
//     data: data ? new URLSearchParams(data).toString() : null
//   };

//   const authHeader = oauth.toHeader(oauth.authorize(requestData, {
//     key: token,
//     secret: tokenSecret,
//   }));

//   const config = {
//     headers: {
//       ...authHeader,
//       'Content-Type': 'application/x-www-form-urlencoded',
//     }
//   };

//   try {
//     const response = method === 'GET' 
//       ? await axios.get(url, config)
//       : await axios.post(url, requestData.data, config);
//     return response.data;
//   } catch (error) {
//     console.error(`MAAS API request failed to ${endpoint}:`, error.response?.data || error.message);
//     throw error;
//   }
// };

// // Machine Operations
// const acquireMachine = async (systemId) => {
//   try {
//     await makeMaasRequest('POST', `/api/2.0/machines/${systemId}/op/acquire`);
//     console.log(`🔒 Acquired machine ${systemId}`);
//     return true;
//   } catch (error) {
//     console.error(`❌ Failed to acquire machine ${systemId}`);
//     return false;
//   }
// };

// const releaseMachine = async (systemId) => {
//   try {
//     await makeMaasRequest('POST', `/api/2.0/machines/${systemId}/op/release`);
//     console.log(`🔓 Released machine ${systemId}`);
//     return true;
//   } catch (error) {
//     console.error(`❌ Failed to release machine ${systemId}`);
//     return false;
//   }
// };

// const addWorkloadAnnotations = async (systemId, domain, name, project) => {
//   try {
//     if (!await acquireMachine(systemId)) return false;
    
//     await makeMaasRequest('POST', `/api/2.0/machines/${systemId}/op/set_workload_annotations`, {
//       domain,
//       name,
//       project
//     });

//     console.log(`🏷️ Added annotations to ${systemId}`);
//     return true;
//   } catch (error) {
//     console.error(`❌ Failed to annotate ${systemId}`);
//     return false;
//   } finally {
//     await releaseMachine(systemId);
//   }
// };

// // Main Import Function
// const importBaremetalServers = async () => {
//   try {
//     const machines = await makeMaasRequest('GET', '/api/2.0/machines/');
//     const poolName = FLAVOR_NAME;
    
//     const deployedMachines = machines.filter(machine =>
//       machine.pool?.name === poolName && machine.status_name === 'Deployed'
//     );

//     console.log(`📦 Found ${deployedMachines.length} deployed machines in "${poolName}"`);

//     for (const machine of deployedMachines) {
//       const domain = USER_TENANT;
//       const project = USER_PROJECT;
//       const name = machine.hostname || machine.system_id;
//       const availabilityZone = AZ;
//       const compoundId = { domain, project, name, availabilityZone };

//       const serverData = {
//         key: compoundId,
//         id: Buffer.from(uuidv4(null, Buffer.alloc(16))),
//         pConfig: { flavor: poolName },
//         serverInfo: {
//           system_id: machine.system_id,
//           hostname: machine.hostname,
//           arch: ARCH || machine.architecture || 'amd64',
//           cpu: machine.cpu_count,
//           mem: machine.memory,
//           vmhost_id: machine.vm_host ? parseInt(machine.vm_host) : 0,
//           IpAddr: machine.ip_addresses || [],
//           serial: machine.serial || 'Unknown',
//           rootVolumeSize: machine.storage?.[0]?.size || 0
//         },
//         osImage: machine.osystem || 'ubuntu/jammy',
//         createTime: Math.floor(Date.now() / 1000),
//         createdBy: USER_ID,
//         cloudInit: '',
//         provider: PROVIDERNAME,
//         status: 4,
//         powerStatus: machine.power_state === 'on' ? 1 : 0
//       };

//       try {
//         const existing = await BaremetalServer.findOne({ 'serverInfo.system_id': machine.system_id });
        
//         if (existing) {
//           await BaremetalServer.updateOne(
//             { _id: compoundId },
//             { $set: serverData }
//           );
//           console.log(`🔄 Updated: ${name}`);
//         } else {
//           await BaremetalServer.create({
//             _id: compoundId,
//             ...serverData
//           });
//           console.log(`✅ Created: ${name}`);
//         }

//         await addWorkloadAnnotations(machine.system_id, domain, name, project);
//       } catch (error) {
//         console.error(`⚠️ Error processing ${name}:`, error.message);
//       }
//     }
//   } catch (error) {
//     console.error('❌ Import failed:', error);
//     throw error;
//   }
// };

// // Entry Point
// const importBaremetal = async () => {
//   try {
//     await connectWithMongoose();
//     await importBaremetalServers();
//     console.log('✨ Baremetal import completed');
//     process.exit(0);
//   } catch (error) {
//     console.error('💥 Fatal error:', error);
//     process.exit(1);
//   }
// };

// export default importBaremetal;