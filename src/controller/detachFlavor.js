// import fs from 'fs';
// import path from 'path';
// import fetch from 'node-fetch';
// import getAdminToken from '../middleware/generateTokenAdmin.js';
// import dotenv from 'dotenv';

// dotenv.config();

// let cachedToken = null;
// const { ADMIN_PORTAL_URL, PROVIDERNAME } = process.env;

// async function detachFlavorFunction(serverId) {
//   if (!cachedToken) {
//     cachedToken = await getAdminToken();
//   }

//   const res = await fetch(`${ADMIN_PORTAL_URL}/api/baremetal-admin/v1/provider/${PROVIDERNAME}/server/${serverId}/flavor`, {
//     method: 'DELETE',
//     headers: {
//       'Accept': '*/*',
//       'Authorization': `Bearer ${cachedToken}`,
//     }
//   });

//   if (res.status === 401) {
//     console.log(`Token expired. Getting a new one...`);
//     cachedToken = await getAdminToken();

//     // Retry
//     return detachFlavor(serverId);
//   }

//   if (!res.ok) {
//     const error = await res.json();
//     console.error(`Failed to detach flavor from ${serverId}:`, error);
//     return;
//   }

//   console.log(`✅ Flavor detached for server: ${serverId}`);
// }

// export default async function detachFlavor() {
// //   const filePath = path.resolve(filename);
//     const filePath = path.join(process.cwd(), 'src' ,'data', 'machine.txt');
//   const content = fs.readFileSync(filePath, 'utf-8');
//   const serverIds = content.split('\n').map(line => line.trim()).filter(line => line);

//   for (const serverId of serverIds) {
//     await detachFlavorFunction(serverId);
//   }
// }

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import getAdminToken from '../middleware/generateTokenAdmin.js';
import dotenv from 'dotenv';

dotenv.config();

const { ADMIN_PORTAL_URL, PROVIDERNAME } = process.env;

let cachedToken = null;

const getServerIdFromName = async (serverName) => {
  if (!cachedToken) {
    cachedToken = await getAdminToken();
  }

  const url = `${ADMIN_PORTAL_URL}/api/baremetal-admin/v1/provider/${PROVIDERNAME}/servers?limit=1000`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${cachedToken}`
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

const detachFlavorFunction = async (serverId) => {
  const res = await fetch(`${ADMIN_PORTAL_URL}/api/baremetal-admin/v1/provider/${PROVIDERNAME}/server/${serverId}/flavor`, {
    method: 'DELETE',
    headers: {
      'Accept': '*/*',
      'Authorization': `Bearer ${cachedToken}`,
    }
  });

  if (res.status === 401) {
    console.log(`Token expired. Getting a new one...`);
    cachedToken = await getAdminToken();
    return detachFlavorFunction(serverId); // Retry with new token
  }

  if (!res.ok) {
    const error = await res.json();
    console.error(`❌ Failed to detach flavor from ${serverId}:`, error);
    return;
  }

  console.log(`✅ Flavor detached for server: ${serverId}`);
};

export default async function detachFlavor() {
  const filePath = path.join(process.cwd(), 'src', 'data', 'machine.txt');
  const content = fs.readFileSync(filePath, 'utf-8');
  const serverNames = content.split('\n').map(line => line.trim()).filter(Boolean);

  cachedToken = await getAdminToken();

  for (const name of serverNames) {
    const serverId = await getServerIdFromName(name);
    if (serverId) {
      await detachFlavorFunction(serverId);
    }
  }
}
