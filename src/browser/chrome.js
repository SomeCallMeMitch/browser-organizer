export const historyBrowser = {
  search: query => chrome.history.search(query),
  getVisits: url => chrome.history.getVisits({url}),
  hasPermission: () => chrome.permissions.contains({permissions: ['history']})
};
export const openDashboard = () => chrome.runtime.openOptionsPage();
