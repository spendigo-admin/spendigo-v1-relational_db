const { MetricServiceClient } = require('@google-cloud/monitoring');
const client = new MetricServiceClient();
async function test() {
    try {
        const projectId = process.env.GCLOUD_PROJECT || 'spendigo-8540c';
        const request = {
            name: `projects/${projectId}`,
            filter: `metric.type = "firebasehosting.googleapis.com/storage/total_bytes"`,
            interval: { startTime: { seconds: Math.floor(Date.now() / 1000) - 86400 }, endTime: { seconds: Math.floor(Date.now() / 1000) } },
        };
        const [ts] = await client.listTimeSeries(request);
        if (ts.length > 0) {
            console.log("Hosting storage resource type:", ts[0].resource.type);
            console.log("First point value:", ts[0].points[0].value);
        } else {
            console.log("No hosting storage time series found.");
        }
    } catch(e) { console.error(e); }
}
test();
