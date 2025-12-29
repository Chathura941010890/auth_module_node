const axios = require('axios');
const { callEncrypt } = require('../../utils/AESEncrypt');
const { safeJsonStringify } = require('../../utils/jsonSecurityUtils');

const qcBackendDedicatedCode = "INQUBE-QC-MODULE";


async function getTeams(userId) {
    try {
        const encrypted = await callEncrypt(qcBackendDedicatedCode);

        const response = await axios.get(`${process.env.MS_QA_API}/qa/api/v1/getUserTeams/${userId}`,
            {
                headers: {
                  "x-api-key": safeJsonStringify(encrypted),
                },
              }
        );

        return response.data;

    } catch (error) {
        console.error('Error fetching user teams:', error);
        throw error;
    }
}

module.exports = {
    getTeams
};
