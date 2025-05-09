// import dotenv from 'dotenv';
// import fs from 'fs';
// import path from 'path';
// import fetch from 'node-fetch';
// import getAdminToken from '../middleware/generateTokenAdmin.js';

// dotenv.config();

// const { ADMIN_PORTAL_URL, PROVIDERNAME, FLAVOR_NAME } = process.env;
// const FILE_PATH = path.join(process.cwd(), '/src/data/machine.txt');

// const attachFlavorFunction = async (serverId, flavorName, token) => {
//   const url = `${ADMIN_PORTAL_URL}/api/baremetal-admin/v1/provider/${PROVIDERNAME}/server/${serverId}/flavor`;

//   try {
//     const response = await fetch(url, {
//       method: 'POST',
//       headers: {
//         Accept: '*/*',
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${token}`
//       },
//       body: JSON.stringify({ flavor: flavorName })
//     });

//     if (!response.ok) {
//       const error = await response.json();
//       console.error(`❌ Failed for server: ${serverId}, flavor: ${flavorName} —`, error);
//     } else {
//       console.log(`✅ Attached flavor "${flavorName}" to server "${serverId}"`);
//     }
//   } catch (err) {
//     console.error(`❌ Error attaching flavor to server "${serverId}":`, err.message);
//   }
// };

// export const attachFlavor = async () => {
//   try {
//     const token = await getAdminToken();
//     const flavorName = FLAVOR_NAME;  // Get the flavor name from .env file

//     const data = fs.readFileSync(FILE_PATH, 'utf-8');
//     const lines = data.split('\n').map(line => line.trim()).filter(Boolean);

//     // Iterate through each serverId in the text file
//     for (const serverId of lines) {
//       // Attach the flavor to each serverId
//       await attachFlavorFunction(serverId, flavorName, token);
//     }

//   } catch (err) {
//     console.error('❌ Failed to run attachFlavor:', err.message);
//   }
// };


import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import getAdminToken from '../middleware/generateTokenAdmin.js';

dotenv.config();

const { ADMIN_PORTAL_URL, PROVIDERNAME, FLAVOR_NAME } = process.env;
const FILE_PATH = path.join(process.cwd(), '/src/data/machine.txt');

/**
 * Fetch server ID using server name.
 */
const getServerIdFromName = async (serverName, token) => {
  const url = `${ADMIN_PORTAL_URL}/api/baremetal-admin/v1/provider/${PROVIDERNAME}/servers?limit=1000`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const json = await res.json();

    if (!res.ok) {
      console.error(`❌ Failed to fetch servers list —`, json);
      return null;
    }

    const servers = json.items;

    if (!Array.isArray(servers)) {
      console.error(`❌ Unexpected response format. Cannot find servers list in:`, json);
      return null;
    }

    const matchedServer = servers.find(server => server.name === serverName);

    if (!matchedServer) {
      console.error(`❌ Server "${serverName}" not found`);
      return null;
    }

    return matchedServer.id;
  } catch (err) {
    console.error(`❌ Error fetching server ID for "${serverName}":`, err.message);
    return null;
  }
};



/**
 * Attach flavor to a server ID.
 */
const attachFlavorFunction = async (serverId, flavorName, token) => {
  const url = `${ADMIN_PORTAL_URL}/api/baremetal-admin/v1/provider/${PROVIDERNAME}/server/${serverId}/flavor`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ flavor: flavorName })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Failed to attach flavor "${flavorName}" to server ID "${serverId}" —`, error);
    } else {
      console.log(`✅ Attached flavor "${flavorName}" to server ID "${serverId}"`);
    }
  } catch (err) {
    console.error(`❌ Error attaching flavor to server ID "${serverId}":`, err.message);
  }
};

/**
 * Main function to attach flavor using server names from file.
 */
export const attachFlavor = async () => {
  try {
    const token = await getAdminToken();
    const flavorName = FLAVOR_NAME;

    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    const lines = data.split('\n').map(line => line.trim()).filter(Boolean);

    for (const serverName of lines) {
      const serverId = await getServerIdFromName(serverName, token);
      if (serverId) {
        await attachFlavorFunction(serverId, flavorName, token);
      }
    }
  } catch (err) {
    console.error('❌ Failed to run attachFlavor:', err.message);
  }
};

