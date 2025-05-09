import axios from 'axios';
import qs from 'qs';
import dotenv from 'dotenv';

dotenv.config();

const { AUTH_URL } = process.env;

export default async function getAdminToken() {
  const data = qs.stringify({
    username: 'ccsadmin',
    grant_type: 'password',
    client_id: 'controller',
    password: 'Welcome@123',
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${AUTH_URL}/auth/realms/cloud/protocol/openid-connect/token`,
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: data,
  };

  try {
    const response = await axios.request(config);
    const token = response.data.access_token;
    return token; // ✅ Return the token
  } catch (error) {
    console.error('Error fetching token:', error.response?.data || error.message);
    throw error;
  }
}
