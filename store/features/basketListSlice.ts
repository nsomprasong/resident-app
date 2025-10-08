
import { MenuModel } from '@/interface/MenuModel';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState: MenuModel[] = [];

const BasketListSlice = createSlice({
  name: 'BasketList',
  initialState,
  reducers: {
    setBasketList: (state, action: PayloadAction<MenuModel[]>) => {
      return action.payload;
    },
    addToBasket: (state, action: PayloadAction<MenuModel>) => {
      state.push(action.payload);
    },
    removeFromBasket: (state, action: PayloadAction<MenuModel>) => {
      state.filter(item => item.id !== action.payload.id)
    }
  },
});

export const { setBasketList, addToBasket, removeFromBasket } = BasketListSlice.actions;
export default BasketListSlice.reducer;
