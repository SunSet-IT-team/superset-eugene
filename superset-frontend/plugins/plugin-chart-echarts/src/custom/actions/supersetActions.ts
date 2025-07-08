const SET_FIELD_VALUE = 'SET_FIELD_VALUE';
const SET_FORCE_QUERY = 'SET_FORCE_QUERY';
const SET_FORM_DATA = 'UPDATE_FORM_DATA';
const SET_EXPLORE_CONTROLS = 'UPDATE_EXPLORE_CONTROLS';
const UPDATE_QUERY_FORM_DATA = 'UPDATE_QUERY_FORM_DATA';
const ADD_TAB = 'ADD_TAB';
const CLEAR_TABS = 'CLEAR_TABS';
const SET_TABS = 'SET_TABS';

export const supersetActions = {
  updateQueryFormData(value: any, key: any) {
    return { type: UPDATE_QUERY_FORM_DATA, value, key };
  },

  setExploreControls(formData: any) {
    return { type: SET_EXPLORE_CONTROLS, formData };
  },

  setFormData(formData: any) {
    return { type: SET_FORM_DATA, formData };
  },

  setForceQuery(force: boolean) {
    return {
      type: SET_FORCE_QUERY,
      force,
    };
  },

  setControlValue(controlName: string, value: any, validationErrors?: any[]) {
    console.log('HERE')
    return { type: SET_FIELD_VALUE, controlName, value, validationErrors };
  },

  addTab(tabs: { key: string; value: string }) {
    return { type: ADD_TAB, tabs };
  },

  clearTabs() {
    return { type: CLEAR_TABS };
  },

  setTabs(data: {
    dashboardTitle: string;
    tabs: { value: string; Label: string; index: number }[];
  }) {
    return { type: SET_TABS, data };
  },
};
