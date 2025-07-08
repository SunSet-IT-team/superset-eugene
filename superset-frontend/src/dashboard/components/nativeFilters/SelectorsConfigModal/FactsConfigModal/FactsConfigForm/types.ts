// Interface for All Datasets
export interface AllDatasets {
  count: number;
  description_columns: Record<string, string>;
  ids: string[];
  label_columns: Record<string, string>;
  list_columns: string[];
  list_title: string;
  order_columns: string[];
  result: DatasetSummary[];
}

interface DatasetSummary {
  changed_by: User;
  changed_by_name: string;
  changed_on_delta_humanized: string;
  changed_on_utc: string;
  database: DatabaseSummary;
  datasource_type: string;
  default_endpoint: string;
  description: string;
  explore_url: string;
  extra: string;
  id: number;
  kind: string;
  owners: Owner[];
  schema: string;
  sql: string;
  table_name: string;
}

interface User {
  first_name: string;
  last_name: string;
}

interface DatabaseSummary {
  database_name: string;
  id: number;
}

interface Owner {
  first_name: string;
  id: number;
  last_name: string;
}

// Interface for Dataset by ID

export interface DatasetById {
  description_columns: Record<string, string>;
  id: string;
  label_columns: Record<string, string>;
  result: DatasetDetail;
  show_columns: string[];
  show_title: string;
}

interface DatasetDetail {
  cache_timeout: number;
  changed_by: User;
  changed_on: string;
  changed_on_humanized: string;
  column_formats: string;
  columns: DatasetColumn[];
  created_by: User;
  created_on: string;
  created_on_humanized: string;
  currency_formats: string;
  database: Database;
  datasource_name: string;
  datasource_type: string;
  default_endpoint: string;
  description: string;
  extra: string;
  fetch_values_predicate: string;
  filter_select_enabled: boolean;
  granularity_sqla: string;
  id: number;
  is_managed_externally: boolean;
  is_sqllab_view: boolean;
  kind: string;
  main_dttm_col: string;
  metrics: Metric[];
  name: string;
  offset: number;
  order_by_choices: string;
  owners: Owner[];
  schema: string;
  select_star: string;
  sql: string;
  table_name: string;
  template_params: string;
  time_grain_sqla: string;
  uid: string;
  url: string;
  verbose_map: string;
}

interface DatasetColumn {
  advanced_data_type: string;
  changed_on: string;
  column_name: string;
  created_on: string;
  description: string;
  expression: string;
  extra: string;
  filterable: boolean;
  groupby: boolean;
  id: number;
  is_active: boolean;
  is_dttm: boolean;
  python_date_format: string;
  type: string;
  type_generic: string;
  uuid: string;
  verbose_name: string;
}

interface Database {
  backend: string;
  database_name: string;
  id: number;
}

interface Metric {
  changed_on: string;
  created_on: string;
  currency: string;
  d3format: string;
  description: string;
  expression: string;
  extra: string;
  id: number;
  metric_name: string;
  metric_type: string;
  verbose_name: string;
  warning_text: string;
}

// Interface for Column Values by Dataset ID and Column Name
export interface ColumnValues {
  result: Array<string | number | boolean | Record<string, unknown>>;
}
