import React from 'react';
import { styled } from '@superset-ui/core';
import Icons from '../../../../../../../../../components/Icons';

const StyledTrashIconActive = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const StyledTrashIconDisabled = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

interface ClearAllButtonProps {
  filtersActive: boolean;
  onClick: () => void;
}

export const ClearAllButton = ({
  filtersActive,
  onClick,
}: ClearAllButtonProps) =>
  filtersActive ? (
    <StyledTrashIconActive iconSize="xl" onClick={onClick} alt="ClearAll" />
  ) : (
    <StyledTrashIconDisabled iconSize="xl" alt="ClearAll" />
  );
