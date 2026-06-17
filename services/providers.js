function getApiUsageReport(runtime) {
  return runtime.getApiUsageReport();
}

function testApiProvider(runtime, providerId) {
  return runtime.testApiProvider(providerId);
}

module.exports = {
  getApiUsageReport,
  testApiProvider
};
