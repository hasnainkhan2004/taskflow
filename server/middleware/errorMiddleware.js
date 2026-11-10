const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || error.status || (
    res.statusCode >= 400 ? res.statusCode : 500
  );
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Server error'
    : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ message });
};

module.exports = { notFound, errorHandler };
