import Joi from 'joi';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.js';

// TODO: write a validation schema for create/update per README.md section 2.

const createSchema = Joi.object({
  roomNumber: Joi.string().required(),

  startDate: Joi.date().required(),

  endDate: Joi.date()
    .required()
    .greater(Joi.ref('startDate')),

  purpose: Joi.string().optional(),

  bookedBy: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
});

const updateSchema = Joi.object({
  roomNumber: Joi.string(),

  startDate: Joi.date(),

  endDate: Joi.date(),

  purpose: Joi.string(),

  bookedBy: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
});

// TODO: per README.md section 4, you will need a way to detect whether a
// proposed booking conflicts with an existing one on the same room.

// GET /api/bookings
// TODO: implement per README.md section 3.

export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .populate('bookedBy', 'name email')
      .lean();

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.

export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
// TODO: implement per README.md sections 3 and 4.

export async function createBooking(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Check whether another booking overlaps this time range
    const conflict = await Booking.findOne({
      roomNumber: value.roomNumber,
      startDate: { $lt: value.endDate },
      endDate: { $gt: value.startDate }
    });

    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked during this time range'
      });
    }

    const booking = await Booking.create(value);

    await booking.populate('bookedBy', 'name email');

    res.status(201).json({ booking });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:id
// TODO: implement per README.md sections 3, 4, and 5.

export async function updateBooking(req, res, next) {
  try {
    // First find the existing booking
    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Validate only the fields being updated
    const { value, error } = updateSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Combine old values with the new values
    const updatedBooking = {
      roomNumber: value.roomNumber ?? existing.roomNumber,
      startDate: value.startDate ?? existing.startDate,
      endDate: value.endDate ?? existing.endDate,
      purpose: value.purpose ?? existing.purpose,
      bookedBy: value.bookedBy ?? existing.bookedBy
    };

    // Explicitly check that startDate is before endDate
    if (updatedBooking.startDate >= updatedBooking.endDate) {
      return res.status(400).json({
        message: 'startDate must be before endDate'
      });
    }

    // Check for conflicts with OTHER bookings
    const conflict = await Booking.findOne({
      _id: { $ne: req.params.id },
      roomNumber: updatedBooking.roomNumber,
      startDate: { $lt: updatedBooking.endDate },
      endDate: { $gt: updatedBooking.startDate }
    });

    if (conflict) {
      return res.status(409).json({
        message: 'Room is already booked during this time range'
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updatedBooking },
      {
        new: true,
        runValidators: true
      }
    ).populate('bookedBy', 'name email');

    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
// TODO: implement per README.md sections 3 and 5.

export async function deleteBooking(req, res, next) {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}