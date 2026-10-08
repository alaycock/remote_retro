import { createAsyncThunk } from "@reduxjs/toolkit"
import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState, ThunkExtra } from "./index"

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState
  dispatch: AppDispatch
  extra: ThunkExtra
  rejectValue: string
}>()
