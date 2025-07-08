import { styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export const StyledTrashIcon = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

export const StyledInfoIcon = styled(Icons.Info)`
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

export const StyledWarning = styled.span`
  color: ${({ theme }) => theme.colors.warning.base};
`;

export const StyledBottomWarning = styled.span`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

export const Container = styled.div`
  height: 100%;
  overflow-y: auto;
`;

export const StyledItemTitle = styled.div`
  ${({ theme }) => `
      display: flex;
      align-items: center;
      padding: ${theme.gridUnit * 0.5}px ${theme.gridUnit * 2}px;
      width: 100%;
      border-radius: ${theme.borderRadius}px;
      cursor: pointer;
      &.active {
        color: ${theme.colors.grayscale.dark1};
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.secondary.light4};
        span, .anticon {
          color: ${theme.colors.grayscale.dark1};
        }
      }
      &:hover {
        color: ${theme.colors.primary.light1};
        span, .anticon {
          color: ${theme.colors.primary.light1};
        }
      }
      &.errored div, &.errored .warning {
        color: ${theme.colors.error.base};
      }
  `}
`;

export const StyledWrapper = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

export const StyledText = styled.div`
  align-items: center;
  display: flex;
  word-break: break-all;
`;
