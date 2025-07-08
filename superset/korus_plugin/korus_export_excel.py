import io
import pandas as pd
from typing import Any
from superset.utils.excel import quote_formulas


def replace_string(
    df: pd.DataFrame,
    columns_to_replace_in: list[str],
    string_to_replace: str = '|-|',
    string_to_replace_with: str = ' '
) -> pd.DataFrame:
    
    for column in df.select_dtypes(include=["object"]).columns:
        if column in columns_to_replace_in:
            df[column] = df[column].str.replace(string_to_replace, string_to_replace_with)

    return df


def remove_all_after_string(
    df: pd.DataFrame,
    columns_to_replace_in: list[str],
    string_to_remove_after: str = '|<--|'
) -> pd.DataFrame:
    
    for column in df.select_dtypes(include=["object"]).columns:
        if column in columns_to_replace_in:
            df[column] = df[column].apply(
                lambda x : x.split(string_to_remove_after)[0] if isinstance(x, str) and string_to_remove_after in x else x
            )

    return df


def df_to_excel(
        data_df: pd.DataFrame,
        header_df: pd.DataFrame,
        **kwargs: Any
) -> Any:
    output = io.BytesIO()

    # timezones are not supported
    for column in data_df.select_dtypes(include=["datetimetz"]).columns:
        data_df[column] = data_df[column].astype(str)

    post_process_columns = [
        'fulldesc'
    ]

    data_df = remove_all_after_string(data_df, post_process_columns)
    data_df = replace_string(data_df, post_process_columns)

    # make sure formulas are quoted, to prevent malicious injections
    data_df = quote_formulas(data_df)

    # pylint: disable=abstract-class-instantiated
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        header_len = len(header_df)
        header_df.to_excel(writer, header=False, index=False, **kwargs)
        data_df.to_excel(writer, startrow=header_len + 1, **kwargs)

        """ Пример. Удали коммент после имплементации 
        workbook  = writer.book
        worksheet = writer.sheets['Sheet1']

        num_format = workbook.add_format({'num_format': '#,#00.0'})
        # TODO: необходимо указывать индекс всех колонок которые флоаты
        worksheet.set_column(2,2, None, num_format)
        """

    return output.getvalue()

