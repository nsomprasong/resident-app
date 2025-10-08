import { BookingDetail } from '@/interface/BookingDetailModel';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const initialState: BookingDetail = {} as BookingDetail;

const BookingDetailSlice = createSlice({
  name: 'BookingDetail',
  initialState,
  reducers: {
    setBookingDetail: (state, action: PayloadAction<BookingDetail>) => {
      return {...state, ...action.payload};
    },
  },
});

export const { setBookingDetail } = BookingDetailSlice.actions;
export default BookingDetailSlice.reducer;
