'use client';

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { BookingDetail } from "@/interface/BookingDetailModel";
import { setBookingDetail as setBookingDetailAction } from "../store/features/bookDetailSlice";

export const useBookingDetail = () => {
    const dispatch = useDispatch();
    const bookingDetail = useSelector((state: RootState) => state.bookDetail);

    const setBookingDetail = (data: BookingDetail) => {
        dispatch(setBookingDetailAction(data));
    }

    return { bookingDetail, setBookingDetail };
}