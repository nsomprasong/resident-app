'use client';

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { setBasketList as setBasketListAction, addToBasket as addToBasketAction, removeFromBasket as removeFromBasketAction } from "../store/features/basketListSlice";
import { MenuModel } from "@/interface/MenuModel";

export const useBasketList = () => {
    const dispatch = useDispatch();
    const basketList  = useSelector((state: RootState) => state.basketList);

    const setBasketList = (data: MenuModel[]) => dispatch(setBasketListAction(data));
    const addToBasket = (item: MenuModel) => dispatch(addToBasketAction(item));
    const removeFromBasket = (item: MenuModel) => dispatch(removeFromBasketAction(item));

    return { basketList, setBasketList, addToBasket, removeFromBasket };
} 