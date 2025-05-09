import dotenv from 'dotenv';
import inquirer from 'inquirer';
import getAdminToken from '../middleware/generateTokenUser.js';
import axios from 'axios';

dotenv.config();

const cloudinit = "#cloud-config\nusers:\n  - name: ubuntu\n    sudo: ALL=(ALL) NOPASSWD:ALL\n    shell: /bin/bash\n    lock_passwd: false\n    ssh-authorized-keys:\n      - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCcpcXcwFR5uiSzIrlCCmbmd5Qy5CaSJtaLn5kmSpAT3VfZhaQMz0RQZvjoMh3iXOOvL/s2OPrDyM7ElnTR/thCdfuRNTUtEdWC2BkW+TEwJDKD5xqLeiERB9PV/n5L+cvD7YQDdeG9Z12D4IhVf3k8QWyLlZiskN2PTdgkNJpVkvFTdFGv6DMACYNliE2v+cYw5WBXXxoADoqWaFLsqHO1iuutn5Bq2v3v5PxImEG2N8+Hw+nbeuTAqlgL7DLsLfJd3xqNtMdi7CZtrKVbi69esJoSb7LJeJMFHAr60m6uelayAoC3C+gPBuGMzPCo35Ki2hNPRkHCj/5j5Q1AF9+/hls4xQa7GdpmX/LTwRFzSpjH4JwOIEaLsVxck6MVF8RFwZ+5E68pRMRei4myGoDuKROI0+wTPpdCo+A2w6z4HlB+9vuWIyzVa2AOmMgSq2ra6yR4vgNBDeE/G+a4mUpete61VmLF9tv0kj0GgXSLWZ5/hgp7TLj21vjEFrnGxes= cehermes@hermes-rackcontroller1\n\n  - name: test\n    passwd: India@987654321\n    lock_passwd: false\n    ssh-authorized-keys:\n      - ssh-rsa your_public_ssh_key_here\n    sudo: ALL=(ALL) NOPASSWD:ALL\n    plain_text_passwd: 1234\n\nssh_pwauth: true\n\nwrite_files:\n  - path: /etc/systemd/system.conf.d/proxy.conf\n    content: |\n      [Manager]\n      DefaultEnvironment=\"http_proxy=http://svc_proxy_nonrte_netgrp:jLNgeTuuCdbu9h9kesPaA4iEDrzHvXtR@172.22.13.140:3128\"\n      DefaultEnvironment=\"https_proxy=http://svc_proxy_nonrte_netgrp:jLNgeTuuCdbu9h9kesPaA4iEDrzHvXtR@172.22.13.140:3128\"\n      DefaultEnvironment=\"no_proxy=internal.coredge.io,localhost,127.0.0.1,127.0.1.1,10.96.0.0/16,10.244.0.0/16,.svc,.svc.cluster.local,cluster.local,192.168.100.0/24,172.27.106.0/24,172.27.98.0/24,172.26.133.0/24,172.26.135.0/24,172.26.134.0/24,172.26.136.0/24,172.27.84.0/22,172.0.0.0/8,console.mi210.core42.hpc,admin.mi210.core42.hpc,metalcontroller.mi210.core42.hpc\"\n    owner: root:root\n    permissions: '0644'\n\n  - path: /etc/environment\n    content: |\n      http_proxy=\"http://svc_proxy_nonrte_netgrp:jLNgeTuuCdbu9h9kesPaA4iEDrzHvXtR@172.22.13.140:3128\"\n      https_proxy=\"http://svc_proxy_nonrte_netgrp:jLNgeTuuCdbu9h9kesPaA4iEDrzHvXtR@172.22.13.140:3128\"\n      no_proxy=\"internal.coredge.io,localhost,127.0.0.1,127.0.1.1,10.96.0.0/16,10.244.0.0/16,.svc,.svc.cluster.local,cluster.local,192.168.100.0/24,172.27.106.0/24,172.27.98.0/24,172.26.133.0/24,172.26.135.0/24,172.26.134.0/24,172.26.136.0/24,172.27.84.0/22,172.0.0.0/8,console.mi210.core42.hpc,admin.mi210.core42.hpc,metalcontroller.mi210.core42.hpc\"\n    owner: root:root\n    permissions: '0644'\n\nruncmd:\n  - sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/g' /etc/ssh/sshd_config\n  - systemctl restart sshd\n  - systemctl daemon-reload\n  - echo '172.26.135.202 console.mi210.core42.hpc' >> /etc/hosts\n  - curl -k \"https://console.mi210.core42.hpc/api/cluster-manager/v1/download/compass-host-agent?packageType=debian&arch=amd64\" -o compass-host-agent_amd64.deb\n  - sudo apt-get install -y ./compass-host-agent_amd64.deb\n  - sudo compass-host-agent configure -c console.mi210.core42.hpc -D mbzuai -P project-1 -b 8030 -p 8040 -k wfrPAb2cZttiNeMdUaDrfGDfw7naii"

export default async function allocateBaremetal() {
  const token = await getAdminToken();

  const { count } = await inquirer.prompt([
    {
      type: 'input',
      name: 'count',
      message: 'How many baremetal servers do you want to create?',
      validate: function (value) {
        const valid = !isNaN(parseInt(value)) && parseInt(value) > 0;
        return valid || 'Please enter a valid positive number';
      },
    },
  ]);

  const total = parseInt(count);
//   const baseName = process.env.BAREMETAL_NAME;
  const { BAREMETAL_NAME,USER_PORTAL_URL,USER_TANENT,USER_PROJECT, OS_IMAGE, FLAVOR_NAME,AZ,REGION } = process.env;


  for (let i = 1; i <= total; i++) {
    const serverName = `${BAREMETAL_NAME}-${i}`;
    console.log(`🔧 Creating server: ${serverName}`);

    let data = JSON.stringify({
      name: serverName,
      osImage: OS_IMAGE,
      flavor: FLAVOR_NAME,
      cloudInit: cloudinit,
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: `${USER_PORTAL_URL}/api/baremetal-manager/v1/domain/${USER_TANENT}/project/${USER_PROJECT}/server`,
      headers: {
        Accept: '*/*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        Connection: 'keep-alive',
        Authorization: `Bearer ${token}`,
        'ce-availability-zone': AZ,
        'ce-region': REGION,
        'content-type': 'application/json',
        'external-project': USER_PROJECT,
        'organisation-name': USER_TANENT,
        'project-name': USER_PROJECT,
      },
      data: data,
    };

    try {
      const response = await axios.request(config);
      console.log(`✅ Created: ${serverName}`, response.data);
    } catch (error) {
      console.error(`❌ Error creating ${serverName}:`, error?.response?.data || error.message);
    }
  }
}
