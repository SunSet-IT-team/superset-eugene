from superset.utils.backports import StrEnum

class ExcelExportHeaderKey(StrEnum):
    """
    Types of header rows during export to excel
    """
    SELECTOR_DATE = 'Selector_date'
    EXPORTDATA = 'korus_export_info'
    EXPORTDATA_SELECTOR = 'korus_export_info_selector'
    SEPARATOR = 'Separator'

class ExcelExportDictKey(StrEnum):
    """
    Different option sets stored in EXCEL_EXPORT configuration variable
    """     
    ENGINE = 'Engine'
    HEADER = 'Header'
