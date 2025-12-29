const { parentPort, workerData } = require('worker_threads');
const Log = require('../models/log')
const { getCurrentDateForDB } = require('../utils/dateUtils');

async function writeLogs(action_taken, table_name, column_name, from_value, to_value) {
    try{
        if(
            action_taken && action_taken != "" &&
            table_name && table_name != "" && 
            column_name && column_name != "" &&
            from_value && 
            to_value
        ){
            await Log.create({
                action_taken,
                table_name,
                column_name,
                from_value,
                to_value,
                time_stamp: getCurrentDateForDB()
            })
        }

        return 'success'
    }
    catch(err){
        console.log(err);
    }
}

(async () => {
    const output = await writeLogs(
        workerData.action_taken,
        workerData.table_name,
        workerData.column_name,
        workerData.from_value,
        workerData.to_value
    );
    parentPort.postMessage(output);
})();

// Handle worker thread shutdown
// process.on('SIGINT', () => {
//   writeLogs.close();
//   process.exit(0);
// });

// process.on('SIGTERM', () => {
//   writeLogs.close();
//   process.exit(0);
// });